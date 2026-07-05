const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_TTL = 30 * 60 * 1000;
const FILE_LIST_TTL = 30 * 60 * 1000;
const GH_HEADERS = { 'User-Agent': 'GameVault/1.0' };

let gamesCache = null;
let gamesCacheAt = 0;
let nebulaFileList = null;
let nebulaFileListAt = 0;
let hypackelFileList = null;
let hypackelFileListAt = 0;

app.use(express.json());

// Serve static files with permissive headers for game iframes
app.use(function(req, res, next) {
  res.removeHeader('X-Frame-Options');
  res.removeHeader('Content-Security-Policy');
  next();
});
app.use(express.static(__dirname));

// Serve game directories explicitly
app.use('/games', express.static(path.join(__dirname, 'games')));

var PALETTE = [
  '#e94560','#0f3460','#1a8fe0','#e9a820','#20c997','#6f42c1',
  '#fd7e14','#17a2b8','#28a745','#dc3545','#007bff','#ffc107',
  '#6610f2','#e83e8c','#20c9a0','#e98c20','#2060e9','#e92060'
];

var CAT_ICONS = {
  'action': '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" fill="none"/>',
  'racing': '<path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" fill="none"/><path d="M9 8l6 4-6 4V8z" fill="rgba(255,255,255,0.25)"/>',
  'sports': '<circle cx="12" cy="12" r="7" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" fill="none"/><path d="M7 12l5-3 5 3-5 3-5-3z" fill="rgba(255,255,255,0.25)"/>',
  'puzzle': '<rect x="5" y="5" width="14" height="14" rx="2" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" fill="none"/><path d="M9 10h6M12 7v6" stroke="rgba(255,255,255,0.3)" stroke-width="2" fill="none"/>',
  'platformer': '<path d="M4 18l4-8 4 8 4-8 4 8" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" fill="none"/><circle cx="12" cy="10" r="2" fill="rgba(255,255,255,0.25)"/>',
  'shooter': '<path d="M12 4v16M4 12h16" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/><circle cx="12" cy="12" r="4" fill="rgba(255,255,255,0.2)"/>',
  'horror': '<path d="M12 3L3 21h18L12 3z" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.25)" stroke-width="1"/><circle cx="9" cy="15" r="1.5" fill="rgba(255,255,255,0.4)"/><circle cx="15" cy="15" r="1.5" fill="rgba(255,255,255,0.4)"/>',
  'retro': '<rect x="4" y="6" width="16" height="12" rx="2" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" fill="none"/><rect x="7" y="9" width="3" height="3" fill="rgba(255,255,255,0.25)"/><rect x="14" y="9" width="3" height="3" fill="rgba(255,255,255,0.25)"/>',
  'rpg': '<path d="M12 2l4 4h-3v5l4-1-2 4 4 2-5 3 1 4-3-2-3 2 1-4-5-3 4-2-2-4 4 1V6h-3l4-4z" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>',
  'fighting': '<circle cx="8" cy="10" r="3" fill="rgba(255,255,255,0.2)"/><circle cx="16" cy="10" r="3" fill="rgba(255,255,255,0.2)"/><path d="M5 18c2-3 10-3 14 0" stroke="rgba(255,255,255,0.25)" stroke-width="2" fill="none"/>',
  'simulation': '<rect x="5" y="8" width="14" height="10" rx="1" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" fill="none"/><path d="M8 12h8M8 15h5" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" fill="none"/>',
  'strategy': '<polygon points="12,4 20,18 4,18" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" fill="none"/><circle cx="12" cy="14" r="2" fill="rgba(255,255,255,0.25)"/>',
  'idle': '<circle cx="12" cy="12" r="7" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" fill="none"/><path d="M12 8v4l3 2" stroke="rgba(255,255,255,0.3)" stroke-width="2" fill="none"/>',
  'endless': '<path d="M4 12h3l2-3 2 6 2-6 2 6 2-3h3" stroke="rgba(255,255,255,0.25)" stroke-width="2" fill="none"/>',
  'arcade': '<circle cx="12" cy="12" r="8" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" fill="none"/><path d="M9 9l6 6M15 9l-6 6" stroke="rgba(255,255,255,0.3)" stroke-width="2" fill="none"/>',
  'casual': '<path d="M12 5v3M12 16v3M5 12h3M16 12h3" stroke="rgba(255,255,255,0.3)" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="7" stroke="rgba(255,255,255,0.15)" stroke-width="1" fill="none"/>',
  'adventure': '<path d="M12 2l-3 5h2v4l-4-1-1 4 3 2-1 4 4-2 4 2-1-4 3-2-1-4-4 1V7h2l-3-5z" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>',
  'minecraft': '<rect x="5" y="5" width="14" height="14" rx="2" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" fill="none"/><rect x="8" y="8" width="3" height="3" fill="rgba(255,255,255,0.3)"/><rect x="13" y="8" width="3" height="3" fill="rgba(255,255,255,0.15)"/><rect x="8" y="13" width="3" height="3" fill="rgba(255,255,255,0.15)"/><rect x="13" y="13" width="3" height="3" fill="rgba(255,255,255,0.3)"/>',
  'pokemon': '<circle cx="12" cy="12" r="8" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" fill="none"/><circle cx="12" cy="12" r="4" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/><circle cx="12" cy="12" r="1.5" fill="rgba(255,255,255,0.35)"/>',
  'zelda': '<polygon points="12,3 3,12 12,21 21,12" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" fill="none"/><circle cx="12" cy="12" r="3" fill="rgba(255,255,255,0.2)"/>',
  'mario': '<ellipse cx="12" cy="14" rx="6" ry="4" fill="rgba(255,255,255,0.15)"/><circle cx="12" cy="8" r="4" fill="rgba(255,255,255,0.2)"/>',
  'sonic': '<ellipse cx="12" cy="12" rx="7" ry="5" fill="rgba(255,255,255,0.15)"/><circle cx="9" cy="10" r="1.5" fill="rgba(255,255,255,0.35)"/><circle cx="15" cy="10" r="1.5" fill="rgba(255,255,255,0.35)"/>',
  'multiplayer': '<circle cx="8" cy="9" r="3" fill="rgba(255,255,255,0.2)"/><circle cx="16" cy="9" r="3" fill="rgba(255,255,255,0.2)"/><path d="M4 18c1-3 6-3 8 0M12 18c2-3 7-3 8 0" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" fill="none"/>',
  'parkour': '<path d="M6 18l4-8 3 4 3-6 2 5" stroke="rgba(255,255,255,0.25)" stroke-width="2" fill="none"/><circle cx="16" cy="7" r="1.5" fill="rgba(255,255,255,0.35)"/>'
};

app.get('/api/thumb/:seed', function(req, res) {
  var seed = req.params.seed || '';
  var letter = seed.charAt(0).toUpperCase();
  if (!letter || !/[A-Z0-9]/.test(letter)) letter = '?';
  var hash = 0;
  for (var i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  var idx = Math.abs(hash) % PALETTE.length;
  var color = PALETTE[idx];

  var lighter = adjustColor(color, 30);
  var darker = adjustColor(color, -30);

  var low = seed.toLowerCase();
  var catPath = '';
  for (var key in CAT_ICONS) {
    if (low.indexOf(key) > -1 || (key === 'multiplayer' && (low.indexOf('multi') > -1 || low.indexOf('2p') > -1 || low.indexOf('2-player') > -1 || low.indexOf('coop') > -1 || low.indexOf('versus') > -1))) {
      catPath = CAT_ICONS[key];
      break;
    }
  }

  var dots = '';
  for (var d = 0; d < 8; d++) {
    var dx = 10 + (d * 14) % 100;
    var dy = 8 + (d * 23 + 7) % 100;
    var dox = 12 + (d * 37) % 96;
    dots += '<circle cx="' + dx + '" cy="' + dy + '" r="1.5" fill="rgba(255,255,255,0.06)"/>' +
      '<circle cx="' + dox + '" cy="' + (105 - dy) + '" r="1" fill="rgba(255,255,255,0.04)"/>';
  }

  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">' +
    '<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="' + lighter + '"/><stop offset="100%" stop-color="' + darker + '"/></linearGradient>' +
    '<filter id="s"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="rgba(0,0,0,0.4)"/></filter></defs>' +
    '<rect width="120" height="120" rx="16" fill="url(#g)"/>' +
    dots +
    (catPath ? '<g transform="translate(60,38)" opacity="0.8">' + catPath + '</g>' : '<circle cx="60" cy="60" r="28" fill="rgba(255,255,255,0.08)"/>') +
    '<text x="60" y="52" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="bold" fill="white" filter="url(#s)" opacity="0.95">' + letter + '</text>' +
    '<text x="60" y="105" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="rgba(255,255,255,0.5)"></text></svg>';

  res.set('Content-Type', 'image/svg+xml');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(svg);
});

function adjustColor(hex, amount) {
  var r = parseInt(hex.substring(1,3), 16);
  var g = parseInt(hex.substring(3,5), 16);
  var b = parseInt(hex.substring(5,7), 16);
  r = Math.min(255, Math.max(0, r + amount));
  g = Math.min(255, Math.max(0, g + amount));
  b = Math.min(255, Math.max(0, b + amount));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

app.get('/api/proxy/*', async function(req, res) {
  var targetUrl = req.params[0];
  if (!targetUrl || !targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    return res.status(400).send('Invalid proxy URL');
  }

  try {
    var response = await axios.get(targetUrl, {
      responseType: 'stream',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      maxRedirects: 5,
      validateStatus: function() { return true; }
    });

    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    res.set('Access-Control-Allow-Origin', '*');
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    response.data.pipe(res);
  } catch (err) {
    res.status(502).type('text/plain').send('Proxy error: ' + err.message);
  }
});

app.get('/api/raw', async function(req, res) {
  var targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Missing ?url= parameter');

  try {
    var response = await axios.get(targetUrl, {
      responseType: 'text',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      maxRedirects: 5
    });

    var body = response.data || '';

    var m = targetUrl.match(/^(https?:\/\/[^\/]+)(\/.*)/);
    var origin = m ? m[1] : '';
    var pathPart = m ? m[2] : '/';
    var baseDir = pathPart;
    if (baseDir.endsWith('.html')) baseDir = baseDir.substring(0, baseDir.lastIndexOf('/') + 1);
    if (!baseDir.endsWith('/')) baseDir += '/';
    var proxyPrefix = '/api/proxy';

    body = body.replace(/<base[^>]*>/gi, '');

    body = body.replace(/((?:src|href|action|data|data-src|data-href|data-main|poster)=")(\/[^"]*)(")/gi, function(m, pre, path, post) {
      if (path.startsWith(proxyPrefix) || path.indexOf('://') > 0) return m;
      return pre + proxyPrefix + origin + path + post;
    });

    body = body.replace(/((?:srcset)=")([^"]*)(")/gi, function(m, pre, val, post) {
      var rewritten = val.split(',').map(function(part) {
        part = part.trim();
        if (!part) return '';
        var tokens = part.split(/\s+/);
        if (tokens[0].startsWith(proxyPrefix)) return part;
        if (tokens[0].startsWith('/')) {
          tokens[0] = proxyPrefix + origin + tokens[0];
        }
        return tokens.join(' ');
      }).join(', ');
      return pre + rewritten + post;
    });

    body = body.replace(/(url\()["']?(\/[^"')]+)["']?\)/gi, function(m, pre, path) {
      if (path.startsWith(proxyPrefix) || path.indexOf('://') > 0) return m;
      return pre + proxyPrefix + origin + path + ')';
    });

    var storageKey = 'gv_' + (targetUrl.replace(/[^a-zA-Z0-9]/g, '').slice(-20));
    var storageScript = '<script>(function(){var k="' + storageKey + '";var ls=localStorage;var g=function(f){return function(){var a=[].slice.call(arguments);a[0]=k+"_"+a[0];return f.apply(ls,a)};};ls.setItem=g(ls.setItem);ls.getItem=g(ls.getItem);ls.removeItem=g(ls.removeItem);})();<\/script>';

    body = body.replace('<head>', '<head><base href="' + (proxyPrefix + '/' + origin + baseDir).replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '">' + storageScript);

    // Strip CSP meta tags and headers from game HTML (blocks scripts/WASM in iframes)
    body = body.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');
    body = body.replace(/<meta[^>]*http-equiv=["']X-Frame-Options["'][^>]*>/gi, '');

    // Strip any source URL references from response body and route them through proxy
    body = body.replace(/(https?:\/\/(?:hypackellite\.github\.io|cdn\.jsdelivr\.net|raw\.githubusercontent\.com)[^\s"'>]*)/gi, '/api/proxy/$1');

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Access-Control-Allow-Origin', '*');
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.send(body);
  } catch (err) {
    console.error('Proxy error for', targetUrl, ':', err.message);
    var gameTitle = targetUrl.split('/').pop().replace(/\.html$/, '').replace(/[-_]/g, ' ');
    res.status(502).type('text/html').send(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
      'body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a1a2e;color:#eee;text-align:center}' +
      '.card{max-width:400px;padding:2rem;background:#16213e;border-radius:12px;border:1px solid #0f3460}' +
      'h2{color:#e94560;margin-top:0}.hint{color:#888;font-size:0.85rem}</style></head><body>' +
      '<div class="card"><h2>Game Unavailable</h2>' +
      '<p>Could not load <strong>' + gameTitle + '</strong></p>' +
      '<p class="hint">' + err.message.replace(/</g, '&lt;').replace(/"/g, '&quot;') + '</p>' +
      '<p class="hint">The game may have been removed or requires external resources that are blocked.</p></div></body></html>'
    );
  }
});

async function getHypackelFileList() {
  if (hypackelFileList && Date.now() - hypackelFileListAt < FILE_LIST_TTL) {
    return hypackelFileList;
  }
  try {
    var res = await axios.get('https://api.github.com/repos/hypackellite/hypackellite.github.io/contents/files', {
      timeout: 15000, headers: GH_HEADERS
    });
    var dirs = [];
    (res.data || []).forEach(function(f) {
      if (f.type === 'dir') dirs.push(f.name);
    });
    var validGames = {};
    await Promise.all(dirs.map(async function(dir) {
      try {
        var sub = await axios.get('https://api.github.com/repos/hypackellite/hypackellite.github.io/contents/files/' + dir, {
          timeout: 10000, headers: GH_HEADERS
        });
        var hasIndex = (sub.data || []).some(function(f) {
          return f.name === 'index.html' && f.type === 'file';
        });
        if (hasIndex) validGames[dir] = true;
      } catch (e) {}
    }));
    hypackelFileList = validGames;
    hypackelFileListAt = Date.now();
    return validGames;
  } catch (err) {
    console.error('Failed to fetch Hypackel file list:', err.message);
    return hypackelFileList || {};
  }
}

async function fetchHypackel() {
  try {
    var [indexRes, validGames] = await Promise.all([
      axios.get('https://raw.githubusercontent.com/hypackellite/hypackellite.github.io/main/index.json', { timeout: 10000 }),
      getHypackelFileList()
    ]);
    var hasDirCheck = Object.keys(validGames).length > 0;
    if (!hasDirCheck) {
      console.log('Hypackel directory list unavailable, falling back to index.json only');
      var seen = {};
      var games = [];
      (indexRes.data || []).forEach(function(g) {
      var dir = '';
      if (g.url) {
        var parts = g.url.replace(/\/index\.html$/, '').split('/');
        dir = parts[parts.length - 1] || parts[parts.length - 2] || '';
      }
      if (!dir) return;
      if (seen[dir]) return; seen[dir] = true;
      if (HYPACKEL_BLOCKLIST[dir]) return;
        var baseId = dir.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'game-' + games.length;
        if (/^\d+$/.test(baseId)) baseId = 'fnaf' + baseId;
        var gTitle = TITLE_FIX[dir] || g.name || dir;
        games.push({
          id: baseId,
          title: gTitle,
          developer: '',
          thumbnail: g.imageSrc ? 'https://hypackellite.github.io' + g.imageSrc : '/api/thumb/' + encodeURIComponent(gTitle),
          url: '/api/raw?url=' + encodeURIComponent('https://raw.githubusercontent.com/hypackellite/hypackellite.github.io/main' + (g.url || ('/files/' + dir + '/index.html'))),
          tags: (g.tags ? g.tags.split(',').map(function(t){ return t.trim(); }).filter(Boolean) : []),
          source: 'hypackel'
        });
      });
      return games;
    }
    var games = [];
    var usedIds = {};
    var indexMap = {};
    (indexRes.data || []).forEach(function(g) {
      var dir = '';
      if (g.url) {
        var parts = g.url.replace(/\/index\.html$/, '').split('/');
        dir = parts[parts.length - 1];
      }
      if (dir && !indexMap[dir]) indexMap[dir] = g;
    });
    Object.keys(validGames).forEach(function(dir) {
      if (HYPACKEL_BLOCKLIST[dir]) return;
      var g = indexMap[dir] || {};
      var baseId = dir.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'game';
      if (/^\d+$/.test(baseId)) baseId = 'fnaf' + baseId;
      if (usedIds[baseId]) { usedIds[baseId]++; baseId += '-' + usedIds[baseId]; }
      else { usedIds[baseId] = 1; }
      var gTitle = TITLE_FIX[dir] || g.name || dir;
      games.push({
        id: baseId,
        title: gTitle,
        developer: '',
        thumbnail: g.imageSrc ? 'https://hypackellite.github.io' + g.imageSrc : '/api/thumb/' + encodeURIComponent(gTitle),
        url: '/api/raw?url=' + encodeURIComponent('https://raw.githubusercontent.com/hypackellite/hypackellite.github.io/main/files/' + dir + '/index.html'),
        tags: (g.tags ? g.tags.split(',').map(function(t){ return t.trim(); }).filter(Boolean) : []),
        source: 'hypackel'
      });
    });
    return games;
  } catch (err) {
    console.error('Hypackel fetch failed:', err.message);
    return [];
  }
}

async function getNebulaFileList() {
  if (nebulaFileList && Date.now() - nebulaFileListAt < FILE_LIST_TTL) {
    return nebulaFileList;
  }
  try {
    var res = await axios.get('https://api.github.com/repos/GoatTech-42/NEBULA-CDN/contents/games', {
      timeout: 15000, headers: GH_HEADERS
    });
    var set = {};
    (res.data || []).forEach(function(f) {
      if (f.name && f.name.endsWith('.html') && f.type === 'file') {
        set[f.name.replace(/\.html$/i, '')] = true;
      }
    });
    nebulaFileList = set;
    nebulaFileListAt = Date.now();
    return set;
  } catch (err) {
    console.error('Failed to fetch NEBULA file list:', err.message);
    return nebulaFileList || {};
  }
}

var NEBULA_BLOCKLIST = {
  '100in1nes': 1, '64in1nes': 1, 'allbossesin1': 1,
  'emujs': 1, 'doswasmx': 1, 'gameandwatchcollection': 1,
  'dknes-collection': 1, 'dknes-collection-v2': 1,
  'exploremodpack': 1,
  'archimedesclient': 1, 'astraclient': 1,
  'dragonxclient': 1, 'g-xclient': 1, 'eb-client-v1-0-0r2-wasm': 1,
  'coverorangeplayerspack': 1, 'coverorangeplayerspack2': 1,
  'coverorangeplayerspack3': 1, 'coverorangeplayerspack3-v2': 1,
  'coverorangeplayerspack3-v3': 1, 'doom3pack': 1,
  'fnfgamebreakerbundle': 1, 'sonicclassiccollection': 1,
  'unknown': 1, 'ai': 1, 'rh': 1, '1': 1,
  'granny22': 1, 'grannycreepy': 1, 'grannynightmare': 1,
  'funnyshooter22': 1
};

var HYPACKEL_BLOCKLIST = {
  'precisionclient': 1
};

var TITLE_FIX = {
  'grannyy': 'Granny',
  'grannynightmare': 'Granny Nightmare',
  'grannycreepy': 'Granny Creepy',
  'baseballbros': 'Baseball Bros',
  'footballbros': 'Football Bros',
  'basketbros': 'Basket Bros',
  'soccerbros': 'Soccer Bros',
  'fnf': 'Friday Night Funkin',
  'fnaf': 'FNAF',
  'fnafworldd': 'FNAF World',
  'fnafps': 'FNAF PS',
  'fnafsl': 'FNAF: Sister Location',
  'fnafucn': 'FNAF: Ultimate Custom Night',
  'fnac1': 'FNAF: The Curse',
  'fnac2': 'FNAF: The Curse 2',
  'fnaw': 'FNAW',
  'fnaf3remastered': 'FNAF 3 Remastered',
  'fnafshooter': 'FNAF Shooter',
  'fnaf4halloween': 'FNAF 4 Halloween',
  'fnafanimatronics': 'FNAF Animatronics',
  'et': 'E.T.'
};

async function fetchNebula() {
  try {
    var catalog = await axios.get('https://raw.githubusercontent.com/GoatTech-42/NEBULA-CDN/main/games.json', { timeout: 20000 });
    var existingFiles = await getNebulaFileList();
    var hasFileCheck = Object.keys(existingFiles).length > 0;
    if (!hasFileCheck) {
      console.log('NEBULA file list unavailable, including all catalog games (blocklist still applies)');
    }
    var baseUrl = 'https://raw.githubusercontent.com/GoatTech-42/NEBULA-CDN/main';
    var games = [];
    var usedIds = {};
    (catalog.data.games || []).forEach(function(g) {
      var slug = g.slug || '';
      if (NEBULA_BLOCKLIST[slug]) return;
      var baseId = g.id || slug || 'game';
      if (usedIds[baseId]) { usedIds[baseId]++; baseId += '-' + usedIds[baseId]; }
      else { usedIds[baseId] = 1; }
      var fileUrl = baseUrl + '/' + (g.file || 'games/' + slug + '.html');
      var gameTitle = TITLE_FIX[slug] || g.name || slug || 'Unknown';
      games.push({
        id: baseId,
        title: gameTitle,
        developer: '',
        thumbnail: '/api/thumb/' + encodeURIComponent(gameTitle),
        url: '/api/raw?url=' + encodeURIComponent(fileUrl),
        tags: [g.category || 'Other'].concat(g.tags || []).filter(Boolean),
        source: 'nebula'
      });
    });
    return games;
  } catch (err) {
    console.error('Nebula fetch failed:', err.message);
    return [];
  }
}

function loadLocalGames() {
  try {
    var local = JSON.parse(fs.readFileSync(path.join(__dirname, 'games.json'), 'utf8'));
    local.forEach(function(g) {
      // Local games are served directly - no proxy wrapping needed
      // Only wrap if it's a full external URL
      if (g.url && (g.url.startsWith('http://') || g.url.startsWith('https://'))) {
        g.url = '/api/raw?url=' + encodeURIComponent(g.url);
      }
      // Local paths like /games/slope/index.html are served as-is
    });
    return local;
  } catch (err) {
    return [];
  }
}

function mergeAll(local, hypackel, nebula) {
  var seenId = {};
  var seenTitle = {};
  var result = [];
  var priority = { '': 0, 'hypackel': 1, 'nebula': 2 };
  [local, hypackel, nebula].forEach(function(list) {
    list.forEach(function(g) {
      if (!seenId[g.id]) {
        seenId[g.id] = true;
        var normTitle = g.title.toLowerCase().trim();
        if (seenTitle[normTitle] !== undefined) {
          var existing = result[seenTitle[normTitle]];
          if (priority[g.source] < priority[existing.source]) {
            result[seenTitle[normTitle]] = g;
          }
        } else {
          seenTitle[normTitle] = result.length;
          result.push(g);
        }
      }
    });
  });
  return result;
}




app.get('/api/games', async function(req, res) {
  try {
    if (gamesCache && Date.now() - gamesCacheAt < CACHE_TTL) {
      return res.json(gamesCache.map(mapGame));
    }
    var results = await Promise.all([
      Promise.resolve(loadLocalGames()),
      fetchHypackel(),
      fetchNebula()
    ]);
    gamesCache = mergeAll(results[0], results[1], results[2]);
    gamesCacheAt = Date.now();
    console.log('Games loaded: local=' + results[0].length + ' hypackel=' + results[1].length + ' nebula=' + results[2].length + ' total=' + gamesCache.length);
    res.json(gamesCache.map(mapGame));
  } catch (err) {
    console.error('/api/games error:', err.message);
    res.json(loadLocalGames().map(mapGame));
  }
});

app.get('/games.json', async function(req, res) {
  try {
    if (gamesCache && Date.now() - gamesCacheAt < CACHE_TTL) {
      return res.json(gamesCache.map(mapGame));
    }
    var results = await Promise.all([
      Promise.resolve(loadLocalGames()),
      fetchHypackel(),
      fetchNebula()
    ]);
    gamesCache = mergeAll(results[0], results[1], results[2]);
    gamesCacheAt = Date.now();
    res.json(gamesCache.map(mapGame));
  } catch (err) {
    console.error('/games.json error:', err.message);
    res.json([]);
  }
});

function mapGame(g) {
  return {
    id: g.id,
    title: g.title,
    category: (g.tags && g.tags.length > 0) ? g.tags[0] : 'Other',
    thumbnailURL: g.thumbnail || '/api/thumb/' + encodeURIComponent(g.title),
    gameURL: g.url,
    source: g.source || ''
  };
}

// Admin: clear games cache
app.post('/api/admin/clear-cache', function(req, res) {
  gamesCache = null;
  gamesCacheAt = 0;
  res.json({ ok: true, message: 'Cache cleared' });
});

// Health check
app.get('/api/health', function(req, res) {
  res.json({ ok: true, cached: !!gamesCache, games: gamesCache ? gamesCache.length : 0, uptime: process.uptime() });
});

app.get('/api/download', async function(req, res) {
  var targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Missing ?url=');
  var gameName = 'game';
  try { var u = new URL(targetUrl); var parts = u.pathname.split('/').filter(Boolean); gameName = parts.pop() || 'game'; if (gameName.endsWith('.html')) gameName = gameName.slice(0, -5); } catch(e) {}

  try {
    var response = await axios.get(targetUrl, { responseType: 'text', timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    var html = response.data || '';
    var baseUrl = targetUrl.replace(/\/[^/]*$/, '/');
    var domain = targetUrl.substring(0, targetUrl.indexOf('/', 8));

    var resolveUrl = function(src) {
      if (src.indexOf('://') > 0) return src;
      return src.startsWith('/') ? domain + src : baseUrl + src;
    };

    var ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    // Step 1: Remove analytics scripts
    html = html.replace(/<script[^>]*src=["'][^"']*(googletagmanager|google-analytics|facebook\.net|doubleclick)[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, '');

    // Step 2: Inline Stylesheets
    var cssMatches = [];
    html.replace(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi, function(m, href) { cssMatches.push({match: m, href: href}); return m; });
    for (var i = 0; i < cssMatches.length; i++) {
      var cm = cssMatches[i];
      try {
        var res = await axios.get(resolveUrl(cm.href), { timeout: 10000, responseType: 'text', headers: { 'User-Agent': ua } });
        html = html.replace(cm.match, '<style>' + (res.data || '').replace(/<\/style>/gi, '<\\/style>') + '</style>');
      } catch(e) {}
    }

    // Step 3: Inline Scripts
    var scriptMatches = [];
    html.replace(/<script[^>]+src=["']([^"']+)["'][^>]*>[\s\S]*?<\/script>/gi, function(m, src) { scriptMatches.push({match: m, src: src}); return m; });
    for (var i = 0; i < scriptMatches.length; i++) {
      var sm = scriptMatches[i];
      if (sm.src.indexOf('googletagmanager') > -1 || sm.src.indexOf('google-analytics') > -1) continue;
      try {
        var res = await axios.get(resolveUrl(sm.src), { timeout: 15000, responseType: 'text', headers: { 'User-Agent': ua } });
        html = html.replace(sm.match, '<script>' + (res.data || '').replace(/<\/script>/gi, '<\\/script>') + '</script>');
      } catch(e) {}
    }

    // Step 4: Inline Images
    var imgMatches = [];
    html.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, function(m, src) { if (!src.startsWith('data:') && !src.startsWith('blob:')) imgMatches.push({match: m, src: src}); return m; });
    for (var i = 0; i < imgMatches.length; i++) {
      var im = imgMatches[i];
      try {
        var res = await axios.get(resolveUrl(im.src), { timeout: 10000, responseType: 'arraybuffer', headers: { 'User-Agent': ua } });
        var b64 = Buffer.from(res.data).toString('base64');
        var ext = im.src.split('.').pop().split('?')[0].toLowerCase();
        var mime = {png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',svg:'image/svg+xml',ico:'image/x-icon'};
        html = html.replace(im.match, im.match.replace(im.src, 'data:' + (mime[ext]||'image/png') + ';base64,' + b64));
      } catch(e) {}
    }

    // Step 5: Remove leftover favicon links
    html = html.replace(/<link[^>]*rel=["'](shortcut icon|icon|apple-touch-icon)["'][^>]*>/gi, '');

    res.set('Content-Disposition', 'attachment; filename="' + gameName.replace(/"/g, '').replace(/[<>:"\/\\|?*]/g, '_') + '.html"');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(502).type('text/plain').send('Download failed: ' + err.message);
  }
});

app.listen(PORT, function() {
  console.log('GameVault server running at http://localhost:' + PORT);
});
