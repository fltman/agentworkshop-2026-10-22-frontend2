// Live preview: serves our local tile and proxies /t/* to the live board.
// Usage: BOARD_URL=https://... node projects/peter/tools/preview/proxy.mjs  (port 8198)
// Query extras on /colony/peter/: opensettings=1 opens the threshold panel; zoomto=lat,lon zooms the map to 13;
// open=<station> opens that station popup after zooming.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../../../..');
const DIR = path.join(ROOT, 'board/public/colony/peter');
const LIVE = (process.env.BOARD_URL || fs.readFileSync(path.join(ROOT, '.board-url'), 'utf8')).trim().replace(/\/$/, '');
const PORT = Number(process.env.PORT || 8198);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/colony/peter/')) {
      let f = path.join(DIR, u.pathname.slice('/colony/peter/'.length));
      if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIR, 'index.html');
      let b = fs.readFileSync(f);
      if (f.endsWith('index.html')) {
        let s = b.toString();
        if (u.searchParams.get('opensettings')) s = s.replace('<details id="settings">', '<details id="settings" open>');
        const z = u.searchParams.get('zoomto');
        if (z) {
          const js = `setTimeout(()=>{peterMap.map.setView([${z.split(',').map(Number).join(',')}],13);setTimeout(()=>peterMap.map.eachLayer(l=>{if(l.station&&l.station.station===${JSON.stringify(u.searchParams.get('open') || '')})l.openPopup()}),2500)},1500)`;
          s = s.replace('</body>', `<script>${js}</script></body>`);
        }
        b = Buffer.from(s);
      }
      res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
      return res.end(b);
    }
    if (u.pathname === '/t/babtist/api/stream') {
      // Headless Chrome never finishes on an open SSE stream: send one event, a long retry, and close.
      const t = await (await fetch(LIVE + '/t/babtist/api/status' + u.search)).text();
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      return res.end(`retry: 600000\nevent: status\ndata: ${t.replace(/\n/g, '')}\n\n`);
    }
    const r = await fetch(LIVE + req.url);
    res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || '' });
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) { res.writeHead(502); res.end(String(e.message)); }
}).listen(PORT, () => console.log(`preview on http://localhost:${PORT}/colony/peter/ -> ${LIVE}`));
