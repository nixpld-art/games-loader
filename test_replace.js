var axios = require('axios');
var targetUrl = 'https://hypackellite.github.io/files/drive-mad/index.html';

axios.get(targetUrl, { responseType: 'text', timeout: 15000 }).then(async function(resp) {
  var html = resp.data;
  var baseUrl = targetUrl.replace(/\/[^/]*$/, '/');
  var domain = targetUrl.substring(0, targetUrl.indexOf('/', 8));
  var resolveUrl = function(src) {
    if (src.indexOf('://') > 0) return src;
    return src.startsWith('/') ? domain + src : baseUrl + src;
  };

  // Step 1: remove analytics
  html = html.replace(/<script[^>]*src=["'][^"']*(googletagmanager|google-analytics)["'][^>]*>[\s\S]*?<\/script>/gi, '');

  // Step 2: collect script matches
  var scriptMatches = [];
  html.replace(/<script[^>]+src=["']([^"']+)["'][^>]*>[\s\S]*?<\/script>/gi, function(m, src) {
    scriptMatches.push({ match: m, src: src });
    return m;
  });

  console.log('Scripts to inline: ' + scriptMatches.length);
  scriptMatches.forEach(function(sm, i) {
    console.log(i + ': src=' + sm.src + ' exists=' + html.includes(sm.match));
  });

  // Step 3: inline each sequentially
  for (var i = 0; i < scriptMatches.length; i++) {
    var sm = scriptMatches[i];
    var fullUrl = resolveUrl(sm.src);
    var before = html.includes(sm.match);
    try {
      var data = (await axios.get(fullUrl, { timeout: 15000, responseType: 'text' })).data;
      if (data) {
        html = html.replace(sm.match, '<script>' + data.replace(/<\//g, '<\\/') + '</script>');
        console.log(i + ': INLINED ' + sm.src + ' (match existed: ' + before + ')');
      }
    } catch(e) {
      console.log(i + ': FAILED ' + sm.src + ': ' + e.message + ' (match existed: ' + before + ')');
    }
  }

  // Final count
  var remaining = [];
  html.replace(/<script[^>]+src=["']([^"']+)["'][^>]*>[\s\S]*?<\/script>/gi, function(m, src) {
    remaining.push(src);
    return m;
  });
  console.log('Remaining: ' + remaining.length);
  remaining.forEach(function(r) { console.log('  ' + r); });
});
