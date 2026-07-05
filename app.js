(function(){
'use strict';

var GAMES = [];
var FILTERED = [];
var ACTIVE_TAG = null;
var SEARCH_TERM = '';
var CURRENT_GAME = null;
var PLAY_TRACKER_KEY = 'gv_plays';
var CLOAK_KEY = 'gv_cloak';
var BG_KEY = 'gv_bg';
var BG_PRESETS = {
  'default': { name: 'Default', css: '' },
  'galaxy': { name: 'Galaxy', css: 'linear-gradient(135deg, #0d0d2b 0%, #1a0a3e 30%, #2d1b69 60%, #0d0d2b 100%)' },
  'ocean': { name: 'Ocean', css: 'linear-gradient(135deg, #0a1628 0%, #0d2b45 40%, #144272 70%, #0a1628 100%)' },
  'sunset': { name: 'Sunset', css: 'linear-gradient(135deg, #1a0a0a 0%, #3d1515 30%, #6b2d1b 60%, #1a0a0a 100%)' },
  'midnight': { name: 'Midnight', css: 'linear-gradient(135deg, #050510 0%, #0d1117 40%, #161b22 70%, #050510 100%)' },
  'matrix': { name: 'Matrix', css: 'linear-gradient(135deg, #050f05 0%, #0a1f0a 40%, #0d2e0d 70%, #050f05 100%)' },
  'neon': { name: 'Neon', css: 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 35%, #0a1a2e 65%, #0a0a1a 100%)' },
  'blur': { name: 'Blur', css: 'radial-gradient(ellipse at 20% 50%, #1a2a4a 0%, transparent 50%), radial-gradient(ellipse at 80% 50%, #2a1a3a 0%, transparent 50%)' }
};

var $ = function(id){ return document.getElementById(id); };
var grid = $('gameGrid');
var skeletonGrid = $('skeletonGrid');
var searchInput = $('searchInput');
var tagList = $('tagList');
var gameCount = $('gameCount');
var resultCount = $('resultCount');
var noGames = $('noGames');
var gameOverlay = $('gameOverlay');
var gameFrame = $('gameFrame');
var closeBtn = $('closeOverlayBtn');
var loadingBar = $('loadingBar');
var overlayTitle = $('overlayTitle');
var launchTabBtn = $('launchTabBtn');
var trendRow = $('trendingRow');
var trendCount = $('trendingCount');
var cloakToggle = $('cloakToggle');
var applyCloakBtn = $('applyCloakBtn');
var resetCloakBtn = $('resetCloakBtn');
var clearPlaysBtn = $('clearPlaysBtn');
var panicBtn = $('panicBtn');
var settingsBtn = $('settingsBtn');
var closeSettingsBtn = $('closeSettingsBtn');
var settingsPanel = $('settingsPanel');
var panelBackdrop = $('panelBackdrop');
var toastEl = $('toast');

function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(function(){ toastEl.classList.add('hidden'); }, 2500);
}

function fetchJson(url){
  return new Promise(function(resolve, reject){
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onload = function(){
      if(xhr.status >= 200 && xhr.status < 300){
        try{ resolve(JSON.parse(xhr.responseText)); }
        catch(e){ reject(e); }
      } else { reject(new Error('HTTP ' + xhr.status)); }
    };
    xhr.onerror = function(){ reject(new Error('Network error')); };
    xhr.send();
  });
}

function getPlays(){
  try{
    var raw = localStorage.getItem(PLAY_TRACKER_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch(e){ return {}; }
}

function savePlays(plays){
  try{ localStorage.setItem(PLAY_TRACKER_KEY, JSON.stringify(plays)); }
  catch(e){}
}

function incrementPlay(id){
  var plays = getPlays();
  plays[id] = (plays[id] || 0) + 1;
  savePlays(plays);
}

function getTopGames(count){
  var plays = getPlays();
  var ids = Object.keys(plays).sort(function(a,b){ return plays[b] - plays[a]; }).slice(0, count);
  var map = {};
  GAMES.forEach(function(g){ map[g.id] = g; });
  var result = [];
  ids.forEach(function(id){
    if(map[id]) result.push({ game: map[id], plays: plays[id] });
  });
  return result;
}

function renderTrending(){
  var top = getTopGames(10);
  if(top.length === 0){
    trendRow.innerHTML = '<div class="no-games" style="padding:20px"><p>Play some games to see trending.</p></div>';
    trendCount.textContent = '';
    return;
  }
  trendCount.textContent = 'Top ' + top.length;
  var html = '';
  top.forEach(function(item, i){
    var g = item.game;
    var fb = g.title ? g.title.charAt(0).toUpperCase() : '?';
    var thumbHtml = g.thumbnail
      ? '<img src="' + g.thumbnail + '" alt="" loading="lazy" onerror="this.classList.add(\'img-error\');this.parentNode.setAttribute(\'data-fallback\',\'' + fb + '\')">'
      : '<div class="fallback">' + fb + '</div>';
    html += '<div class="trending-card" data-id="' + g.id + '">' +
      '<div class="card-thumb">' +
      '<span class="rank-badge">#' + (i+1) + '</span>' +
      thumbHtml +
      '</div>' +
      '<div class="card-body">' +
      '<div class="card-title">' + escHtml(g.title) + '</div>' +
      '<div class="play-count">' + item.plays + ' play' + (item.plays !== 1 ? 's' : '') + '</div>' +
      '</div></div>';
  });
  trendRow.innerHTML = html;
  trendRow.querySelectorAll('.trending-card').forEach(function(el){
    el.addEventListener('click', function(){
      var id = el.getAttribute('data-id');
      var game = GAMES.find(function(g){ return g.id === id; });
      if(game) launchGame(game);
    });
  });
}

function escHtml(s){
  if(!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* Galaxy animation */
function initGalaxy(){
  var canvas = document.getElementById('galaxyCanvas');
  var ctx = canvas.getContext('2d');
  var stars = [];
  var W, H;
  function resize(){
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
  }
  window.addEventListener('resize', resize);
  resize();
  for(var i = 0; i < 300; i++){
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      a: Math.random() * 0.8 + 0.2,
      s: Math.random() * 0.02 + 0.005,
      hue: 220 + Math.random() * 60
    });
  }
  function draw(){
    ctx.clearRect(0, 0, W, H);
    for(var i = 0; i < stars.length; i++){
      var st = stars[i];
      st.y -= st.s * 0.3;
      st.x += Math.sin(st.y * 0.005 + i) * 0.1;
      if(st.y < -5){ st.y = H + 5; st.x = Math.random() * W; }
      st.a += (Math.random() - 0.5) * 0.03;
      st.a = Math.max(0.1, Math.min(1, st.a));
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fillStyle = 'hsla(' + st.hue + ', 40%, ' + (75 + st.r * 10) + '%, ' + st.a + ')';
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  draw();
}

function init(){
  initGalaxy();
  buildBgPresets();
  loadBgState();
  skeletonGrid.style.display = 'grid';
  fetchJson('/api/games').then(function(data){
    GAMES = data;
    gameCount.textContent = GAMES.length;
    skeletonGrid.style.display = 'none';
    loadCloakState();
    buildTags();
    applyFilters();
    renderTrending();
  }).catch(function(err){
    skeletonGrid.innerHTML = '<div class="no-games"><p>Failed to load games. Is the server running?</p></div>';
    gameCount.textContent = 'ERR';
    console.error(err);
  });
}

function buildTags(){
  var tagSet = {};
  GAMES.forEach(function(g){
    (g.tags || []).forEach(function(t){
      var n = t.toLowerCase().trim();
      if(!tagSet[n]) tagSet[n] = 0;
      tagSet[n]++;
    });
  });
  var sorted = Object.keys(tagSet).sort(function(a,b){ return tagSet[b] - tagSet[a]; }).slice(0, 25);
  tagList.innerHTML = '';
  var allBtn = document.createElement('button');
  allBtn.className = 'tag-btn' + (ACTIVE_TAG === null ? ' active' : '');
  allBtn.textContent = 'All';
  allBtn.addEventListener('click', function(){
    ACTIVE_TAG = null;
    document.querySelectorAll('.tag-btn').forEach(function(b){ b.classList.remove('active'); });
    allBtn.classList.add('active');
    applyFilters();
  });
  tagList.appendChild(allBtn);
  sorted.forEach(function(tag){
    var btn = document.createElement('button');
    btn.className = 'tag-btn' + (ACTIVE_TAG === tag ? ' active' : '');
    btn.innerHTML = tag + ' <span class="count">' + tagSet[tag] + '</span>';
    btn.addEventListener('click', function(){
      ACTIVE_TAG = tag;
      document.querySelectorAll('.tag-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      applyFilters();
    });
    tagList.appendChild(btn);
  });
}

function applyFilters(){
  SEARCH_TERM = searchInput.value.toLowerCase().trim();
  FILTERED = GAMES.filter(function(g){
    if(ACTIVE_TAG && (g.tags || []).indexOf(ACTIVE_TAG) === -1) return false;
    if(SEARCH_TERM && g.title.toLowerCase().indexOf(SEARCH_TERM) === -1) return false;
    return true;
  });
  renderGrid();
}

var imageObserver = null;
function setupObserver(){
  if(imageObserver) imageObserver.disconnect();
  imageObserver = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        var img = entry.target;
        if(img.dataset.src){
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        }
        imageObserver.unobserve(img);
      }
    });
  }, { rootMargin: '200px' });
}

function renderGrid(){
  grid.innerHTML = '';
  if(FILTERED.length === 0){
    noGames.classList.remove('hidden');
    resultCount.textContent = '';
    return;
  }
  noGames.classList.add('hidden');
  resultCount.textContent = FILTERED.length + ' game' + (FILTERED.length !== 1 ? 's' : '');
  var fragment = document.createDocumentFragment();
  FILTERED.forEach(function(g){
    var firstLetter = g.title ? g.title.charAt(0).toUpperCase() : '?';
    var thumbHtml = g.thumbnail
      ? '<img data-src="' + g.thumbnail + '" alt="" loading="lazy" onerror="this.classList.add(\'img-error\');this.parentNode.setAttribute(\'data-fallback\',\'' + firstLetter + '\')">'
      : '<div class="fallback">' + firstLetter + '</div>';
    var card = document.createElement('div');
    card.className = 'game-card';
    card.setAttribute('data-id', g.id);
    card.innerHTML =
      '<div class="card-thumb">' + thumbHtml + '</div>' +
      '<div class="card-body">' +
      '<div class="card-title">' + escHtml(g.title) + '</div>' +
      '<div class="card-dev">' + (g.developer ? escHtml(g.developer) : '&nbsp;') + '</div>' +
      '<div class="card-tags">' + (g.tags || []).slice(0, 3).map(function(t){
        return '<span class="card-tag">' + escHtml(t) + '</span>';
      }).join('') + '</div></div>';
    card.addEventListener('click', function(){ launchGame(g); });
    fragment.appendChild(card);
  });
  grid.appendChild(fragment);
  setupObserver();
  document.querySelectorAll('.game-card .card-thumb img[data-src]').forEach(function(img){
    imageObserver.observe(img);
  });
}

function launchGame(game){
  CURRENT_GAME = game;
  incrementPlay(game.id);
  overlayTitle.textContent = game.title;
  gameOverlay.classList.remove('hidden');
  gameFrame.src = '';
  loadingBar.style.width = '10%';
  setTimeout(function(){
    gameFrame.src = game.url;
    loadingBar.style.width = '100%';
    setTimeout(function(){ loadingBar.style.width = '0%'; }, 800);
  }, 100);
  renderTrending();
}

function closeGame(){
  gameOverlay.classList.add('hidden');
  gameFrame.src = '';
  loadingBar.style.width = '0%';
  CURRENT_GAME = null;
}

gameFrame.addEventListener('load', function(){
  loadingBar.style.width = '0%';
});

launchTabBtn.addEventListener('click', function(){
  if(!CURRENT_GAME) return;
  var u = window.location.origin + '/game.html#' + encodeURIComponent(CURRENT_GAME.url);
  window.open(u, '_blank');
});

closeBtn.addEventListener('click', closeGame);
searchInput.addEventListener('input', applyFilters);

searchInput.addEventListener('keydown', function(e){
  if(e.key === 'Enter' && FILTERED.length > 0){
    launchGame(FILTERED[0]);
  }
});

document.addEventListener('keydown', function(e){
  if(e.key === 'Escape'){
    if(!gameOverlay.classList.contains('hidden')){
      closeGame();
      e.preventDefault();
    } else if(!settingsPanel.classList.contains('hidden')){
      closeSettings();
      e.preventDefault();
    }
  }
});

panicBtn.addEventListener('click', function(){
  window.location.href = 'https://classroom.google.com';
});

/* Settings panel */
function openSettings(){
  settingsPanel.classList.remove('hidden');
  panelBackdrop.classList.remove('hidden');
}

function closeSettings(){
  settingsPanel.classList.add('hidden');
  panelBackdrop.classList.add('hidden');
}

settingsBtn.addEventListener('click', openSettings);
closeSettingsBtn.addEventListener('click', closeSettings);
panelBackdrop.addEventListener('click', closeSettings);

/* Background */
function loadBgState(){
  try{
    var saved = localStorage.getItem(BG_KEY);
    if(saved){
      var state = JSON.parse(saved);
      if(state.type === 'preset' && state.value && state.value !== 'default'){
        document.body.classList.add('bg-active');
        var o = $('bgOverlay');
        o.style.background = BG_PRESETS[state.value].css;
        o.style.opacity = '1';
      } else if(state.type === 'upload' && state.data){
        document.body.classList.add('bg-active');
        var o = $('bgOverlay');
        o.style.background = 'url(' + state.data + ') center/cover no-repeat';
        o.style.opacity = '1';
      } else {
        resetBg();
      }
      highlightBgPreset(state);
    }
  } catch(e){}
}

function resetBg(){
  document.body.classList.remove('bg-active');
  var o = $('bgOverlay');
  o.style.background = '';
  o.style.opacity = '0';
  try{ localStorage.removeItem(BG_KEY); } catch(e){}
}

function setBgPreset(key){
  try{ localStorage.setItem(BG_KEY, JSON.stringify({ type: 'preset', value: key })); } catch(e){}
  if(key === 'default'){
    resetBg();
  } else {
    document.body.classList.add('bg-active');
    var o = $('bgOverlay');
    o.style.background = BG_PRESETS[key].css;
    o.style.opacity = '1';
  }
  highlightBgPreset({ type: 'preset', value: key });
}

function setBgUpload(dataUrl){
  try{ localStorage.setItem(BG_KEY, JSON.stringify({ type: 'upload', data: dataUrl })); } catch(e){}
  document.body.classList.add('bg-active');
  var o = $('bgOverlay');
  o.style.background = 'url(' + dataUrl + ') center/cover no-repeat';
  o.style.opacity = '1';
  highlightBgPreset({ type: 'upload', data: dataUrl });
}

function highlightBgPreset(state){
  document.querySelectorAll('.bg-preset-btn').forEach(function(b){ b.classList.remove('active'); });
  if(state && state.type === 'preset'){
    var btn = document.querySelector('.bg-preset-btn[data-key="' + state.value + '"]');
    if(btn) btn.classList.add('active');
  }
}

function buildBgPresets(){
  var container = $('bgPresets');
  if(!container) return;
  var html = '';
  for(var key in BG_PRESETS){
    var p = BG_PRESETS[key];
    var style = p.css ? 'background:' + p.css : 'background:var(--bg-primary)';
    html += '<button class="bg-preset-btn" data-key="' + key + '" style="' + style + '" title="' + p.name + '"><span class="check">\u2713</span></button>';
  }
  container.innerHTML = html;
  container.querySelectorAll('.bg-preset-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      setBgPreset(btn.getAttribute('data-key'));
    });
  });
}

var bgFileInput = $('bgFileInput');
var bgUploadBtn = $('bgUploadBtn');
var bgResetBtn = $('bgResetBtn');
var bgFileName = $('bgFileName');

bgUploadBtn.addEventListener('click', function(){ bgFileInput.click(); });
bgResetBtn.addEventListener('click', resetBg);
bgFileInput.addEventListener('change', function(e){
  var file = e.target.files[0];
  if(!file) return;
  bgFileName.textContent = file.name;
  var reader = new FileReader();
  reader.onload = function(ev){
    setBgUpload(ev.target.result);
    toast('Background updated');
  };
  reader.readAsDataURL(file);
});

/* Tab Cloaking */
function loadCloakState(){
  try{
    var saved = localStorage.getItem(CLOAK_KEY);
    if(saved){
      var state = JSON.parse(saved);
      cloakToggle.checked = state.active || false;
    }
  } catch(e){}
}

function applyCloak(active){
  var state = { active: active };
  try{ localStorage.setItem(CLOAK_KEY, JSON.stringify(state)); } catch(e){}
  if(active){
    var link = document.querySelector('link[rel="icon"]');
    if(link) link.href = 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png';
    document.title = 'My Drive - Google Drive';
    toast('Cloaking active — disguised as Google Drive');
  } else {
    var link = document.querySelector('link[rel="icon"]');
    if(link) link.href = 'data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 16 16\'><text y=\'14\' font-size=\'14\'>📁</text></svg>';
    document.title = 'EduCore Storage Dashboard';
    toast('Cloaking disabled');
  }
}

applyCloakBtn.addEventListener('click', function(){ applyCloak(cloakToggle.checked); });
resetCloakBtn.addEventListener('click', function(){ cloakToggle.checked = false; applyCloak(false); });
clearPlaysBtn.addEventListener('click', function(){
  try{ localStorage.removeItem(PLAY_TRACKER_KEY); } catch(e){}
  renderTrending();
  toast('Play counts reset');
});

init();
})();
