// Batch OG image extractor - fetches game pages and extracts og:image / favicon
// Much faster than Puppeteer - uses plain HTTP requests
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const THUMBS_DIR = path.join(__dirname, 'thumbs');
const SERVER = 'http://localhost:3000';

function extractRealUrl(proxyUrl) {
  var q = proxyUrl.indexOf('?url=');
  if (q >= 0) { try { return decodeURIComponent(proxyUrl.substring(q + 5)); } catch(e) {} }
  if (proxyUrl.indexOf('://') > 0) return proxyUrl;
  return null;
}

function getDomain(url) {
  try { var u = new URL(url); return u.hostname; } catch(e) { return ''; }
}

async function fetchOgImage(url) {
  try {
    var res = await axios.get(url, { timeout: 8000, responseType: 'text', maxRedirects: 3 });
    var html = res.data;
    // og:image
    var m = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
    if (m) return resolveUrl(m[1], url);
    // twitter:image
    m = html.match(/<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/i);
    if (m) return resolveUrl(m[1], url);
    // First large image (likely a screenshot)
    m = html.match(/<img[^>]+src="([^"]+\.(?:png|jpg|jpeg|gif|webp))"[^>]*>(?:\s*<\/img>)?/i);
    if (m && m[1].length > 10) return resolveUrl(m[1], url);
    return null;
  } catch(e) { return null; }
}

function resolveUrl(url, base) {
  if (!url || url.startsWith('data:')) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  try { return new URL(url, base).href; } catch(e) { return null; }
}

async function tryFavicon(domain) {
  try {
    // Try Google Favicon API (works for many sites)
    var res = await axios.get('https://www.google.com/s2/favicons?domain=' + domain + '&sz=128', {
      timeout: 5000, responseType: 'arraybuffer'
    });
    if (res.data && res.data.length > 200) return 'https://www.google.com/s2/favicons?domain=' + domain + '&sz=128';
  } catch(e) {}
  
  // Try direct favicon.ico
  try {
    var res = await axios.get('https://' + domain + '/favicon.ico', {
      timeout: 5000, responseType: 'arraybuffer'
    });
    if (res.data && res.data.length > 200) return 'https://' + domain + '/favicon.ico';
  } catch(e) {}
  return null;
}

async function main() {
  console.log('Fetching game list...');
  var res = await axios.get(SERVER + '/games.json', { timeout: 30000 });
  var allGames = res.data;
  console.log('Total games: ' + allGames.length);

  if (!fs.existsSync(THUMBS_DIR)) fs.mkdirSync(THUMBS_DIR, { recursive: true });

  // Load existing cache
  var cacheFile = path.join(THUMBS_DIR, 'og-cache.json');
  var cache = {};
  if (fs.existsSync(cacheFile)) {
    try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch(e) {}
  }
  console.log('Cached entries: ' + Object.keys(cache).length);

  var ok = 0, fail = 0, total = allGames.length;
  var startTime = Date.now();

  for (var i = 0; i < allGames.length; i++) {
    var g = allGames[i];
    
    // Skip if already cached or already has a screenshot
    if (cache[g.id] || fs.existsSync(path.join(THUMBS_DIR, g.id + '.jpg'))) { ok++; continue; }
    
    // Try to get the real URL
    var realUrl = extractRealUrl(g.gameURL);
    if (!realUrl) { cache[g.id] = null; fail++; continue; }
    
    var domain = getDomain(realUrl);
    
    // 1. Try OG image from the game page
    var imgUrl = await fetchOgImage(realUrl);
    
    // 2. If no OG image, try favicon
    if (!imgUrl && domain) {
      imgUrl = await tryFavicon(domain);
    }
    
    if (imgUrl) {
      // Download and save the image
      try {
        var imgRes = await axios.get(imgUrl, { timeout: 8000, responseType: 'arraybuffer' });
        if (imgRes.data && imgRes.data.length > 200) {
          var ext = path.extname(imgUrl).split('?')[0] || '.jpg';
          if (ext === '.ico') ext = '.png';
          fs.writeFileSync(path.join(THUMBS_DIR, g.id + '.jpg'), imgRes.data);
          cache[g.id] = imgUrl;
          ok++;
          if (ok % 50 === 0) console.log(ok + '/' + total + ' saved=' + ok + ' fail=' + fail);
        } else {
          cache[g.id] = null;
          fail++;
        }
      } catch(e) {
        cache[g.id] = null;
        fail++;
      }
    } else {
      cache[g.id] = null;
      fail++;
    }
    
    // Save cache every 100 games
    if ((ok + fail) % 100 === 0) {
      fs.writeFileSync(cacheFile, JSON.stringify(cache));
    }
    
    // Small delay to avoid rate limiting
    await new Promise(function(r) { setTimeout(r, 100); });
  }

  fs.writeFileSync(cacheFile, JSON.stringify(cache));
  var elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log('=== DONE === ' + elapsed + 's (' + Math.round(elapsed/60) + 'm) ok=' + ok + ' fail=' + fail);
}

main().catch(function(e) { console.error('FATAL:', e.message); });
