const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const THUMBS_DIR = path.join(__dirname, 'thumbs');
const SERVER = 'http://localhost:3000';
const CHUNK = 80;

function extractUrl(proxyUrl) {
  var q = proxyUrl.indexOf('?url=');
  if (q >= 0) { try { return decodeURIComponent(proxyUrl.substring(q + 5)); } catch(e) {} }
  if (proxyUrl.indexOf('://') > 0) return proxyUrl;
  return null;
}

async function main() {
  if (!fs.existsSync(THUMBS_DIR)) fs.mkdirSync(THUMBS_DIR, { recursive: true });

  var progressFile = path.join(THUMBS_DIR, '_progress.json');
  var progress = { index: 0, ok: 0, fail: 0 };
  if (fs.existsSync(progressFile)) {
    try { progress = JSON.parse(fs.readFileSync(progressFile, 'utf8')); } catch(e) {}
  }

  var res = await axios.get(SERVER + '/games.json', { timeout: 30000 });
  var allGames = res.data;
  console.log('Total: ' + allGames.length + ' From: ' + progress.index);

  var br = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-software-rasterizer']
  });

  var pages = [];
  for (var pn = 0; pn < 2; pn++) {
    var pg = await br.newPage();
    await pg.setViewport({ width: 400, height: 400 });
    pages.push(pg);
  }

  var end = Math.min(progress.index + CHUNK, allGames.length);
  var startTime = Date.now();

  for (var i = progress.index; i < end; i += 2) {
    var batchP = [];
    for (var b = 0; b < 2 && (i + b) < end; b++) {
      var g = allGames[i + b];
      var pc = pages[b];
      batchP.push((async function(game, page) {
        var url = extractUrl(game.gameURL);
        if (!url) { progress.fail++; return; }
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 6000 });
          await new Promise(function(r) { setTimeout(r, 800); });
          await page.screenshot({
            path: path.join(THUMBS_DIR, game.id + '.jpg'),
            type: 'jpeg', quality: 80,
            clip: { x: 0, y: 0, width: 400, height: 400 }
          });
          progress.ok++;
        } catch (e) {
          progress.fail++;
        }
        progress.index = i + b + 1;
      })(g, pc));
    }
    await Promise.all(batchP);
  }

  fs.writeFileSync(progressFile, JSON.stringify(progress));
  await br.close();
  var elapsed = Math.round((Date.now() - startTime) / 1000);
  var done = progress.index;
  console.log('Progress: ' + done + '/' + allGames.length + ' ok=' + progress.ok + ' fail=' + progress.fail + ' (' + elapsed + 's)');
  if (done >= allGames.length) { fs.unlinkSync(progressFile); console.log('ALL DONE!'); }
}

main().catch(function(e) { console.error('FATAL:', e.message); });
