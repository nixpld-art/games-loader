const p = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const TD = path.join(__dirname, 'thumbs');
const PF = path.join(TD, '_progress.json');
const SERVER = 'http://localhost:3000';
const BATCH = 200;

async function main() {
  if (!fs.existsSync(TD)) fs.mkdirSync(TD, { recursive: true });
  var prog = { index: 0, ok: 0, fail: 0 };
  if (fs.existsSync(PF)) { try { prog = JSON.parse(fs.readFileSync(PF, 'utf8')); } catch(e) {} }

  var res = await axios.get(SERVER + '/games.json', { timeout: 30000 });
  var games = res.data;
  console.log('Total ' + games.length + ' from ' + prog.index);

  var br = await p.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']
  });
  var pg = await br.newPage();
  await pg.setViewport({ width: 400, height: 400 });
  pg.on('pageerror', function(){}); // Suppress page errors

  var start = Date.now();
  while (prog.index < games.length) {
    var end = Math.min(prog.index + BATCH, games.length);
    for (var i = prog.index; i < end; i++) {
      var g = games[i];
      var url = g.gameURL;
      var q = url.indexOf('?url=');
      if (q >= 0) { try { url = decodeURIComponent(url.substring(q + 5)); } catch(e) {} }
      try {
        await pg.goto(url, { waitUntil: 'load', timeout: 10000 });
        await new Promise(function(r) { setTimeout(r, 3000); });
        await pg.click('canvas').catch(function(){});
        await pg.click('body').catch(function(){});
        await new Promise(function(r) { setTimeout(r, 2000); });
        await pg.screenshot({ path: path.join(TD, g.id + '.jpg'), type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 400, height: 400 } });
        prog.ok++;
      } catch (e) {
        prog.fail++;
      }
      prog.index = i + 1;
    }
    fs.writeFileSync(PF, JSON.stringify(prog));
    var elapsed = Math.round((Date.now() - start) / 1000);
    var pct = Math.round(prog.index / games.length * 100);
    console.log(pct + '% ' + prog.index + '/' + games.length + ' ok=' + prog.ok + ' fail=' + prog.fail + ' (' + elapsed + 's)');
  }

  await br.close();
  fs.unlinkSync(PF);
  var total = Math.round((Date.now() - start) / 60);
  console.log('=== ALL DONE === ' + total + 'min ok=' + prog.ok + ' fail=' + prog.fail);
}

main().catch(function(e) { console.error('FATAL:', e.message); });
