// Live commuter trains on the map (babtist GET /api/trains, shape agreed in #build post 128).
// One arrow per train, rotated by bearing (dot when bearing is null), coloured by delay; click for details.
// Optional layer: if the endpoint is missing or fails, the station map keeps working.
(() => {
  const API = '/t/babtist/api/trains';
  const POLL_MS = 10000;
  const STALE_MS = 2 * 60 * 1000;
  const pm = window.peterMap;
  if (!pm || !window.L) return;
  const { map, layers } = pm;

  const layer = L.layerGroup();
  layers.addOverlay(layer, 'Trains');
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  const q = new URLSearchParams(location.search);
  const want = q.has('trains') ? q.get('trains') !== '0' : store.get('peter.trains') !== '0';
  if (want) layer.addTo(map);
  map.on('overlayadd', (e) => { if (e.layer === layer) { store.set('peter.trains', '1'); poll(); } });
  map.on('overlayremove', (e) => { if (e.layer === layer) store.set('peter.trains', '0'); });

  const note = document.getElementById('mapNote');
  const trainNote = document.createElement('div');
  trainNote.className = 'map-note';
  note.after(trainNote);

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const time = (iso) => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '–'; };
  const age = (ms) => ms < 60000 ? `${Math.max(0, Math.round(ms / 1000))} s` : `${Math.round(ms / 60000)} min`;

  // Delay class against the display's minutes threshold Y: on time below Y, late from Y, very late from 2Y.
  function classify(t, minutes) {
    if (t.canceled) return ['canceled', 'Canceled'];
    if (typeof t.delayMinutes !== 'number') return ['unknown', 'No delay reported yet'];
    if (t.delayMinutes >= 2 * minutes) return ['severe', `${t.delayMinutes} min late`];
    if (t.delayMinutes >= minutes) return ['warning', `${t.delayMinutes} min late`];
    return ['ok', t.delayMinutes > 0 ? `${t.delayMinutes} min late` : 'On time'];
  }

  function icon(cls, bearing, stale) {
    const arrow = typeof bearing === 'number';
    const shape = cls === 'canceled' ? '<span class="tm-x">✕</span>'
      : arrow ? `<span class="tm-arrow" style="transform:rotate(${bearing}deg)"></span>` : '<span class="tm-dot"></span>';
    return L.divIcon({ className: `train-marker tm-${cls}${stale ? ' tm-stale' : ''}`, html: shape, iconSize: [22, 22], iconAnchor: [11, 11] });
  }

  // `to` is a list of destination station signatures (babtist CONTRACT.md); show names where the station list knows them.
  const dest = (to) => (Array.isArray(to) ? to : to ? [to] : []).map((sig) => pm.names.get(sig) || sig).join(' / ');

  function popup(t, label, ageMs) {
    const next = t.nextStation;
    const last = t.lastStation;
    return `<div class="train-pop"><b>Train ${esc(t.train || t.trainId)}</b>${dest(t.to) ? ` → ${esc(dest(t.to))}` : ''}<br>` +
      `<span class="tp-delay">${esc(label)}</span><br>` +
      (next ? `Next: ${esc(next.name || next.station)} ${time(next.estimated || next.scheduled)}` +
        (next.estimated && next.scheduled && next.estimated !== next.scheduled ? ` (planned ${time(next.scheduled)})` : '') + '<br>' : '') +
      (last ? `Last: ${esc(last.name || last.station)} ${time(last.at)}<br>` : '') +
      `<small>Position ${age(ageMs)} old${ageMs > STALE_MS ? ' – may be out of date' : ''}</small></div>`;
  }

  const markers = new Map();
  function draw(data) {
    const minutes = pm.thresholds?.minutes || 5;
    const now = Date.now();
    const seen = new Set();
    const counts = { late: 0, canceled: 0 };
    for (const t of data.trains || []) {
      if (typeof t.lat !== 'number' || typeof t.lon !== 'number' || !t.trainId) continue;
      const id = String(t.trainId);
      seen.add(id);
      const [cls, label] = classify(t, minutes);
      if (cls === 'warning' || cls === 'severe') counts.late++;
      if (cls === 'canceled') counts.canceled++;
      const ageMs = now - new Date(t.positionAt).getTime();
      const stale = !(ageMs <= STALE_MS);
      let m = markers.get(id);
      if (!m) {
        m = L.marker([t.lat, t.lon], { keyboard: true, riseOnHover: true }).bindPopup('').addTo(layer);
        markers.set(id, m);
      } else {
        m.setLatLng([t.lat, t.lon]);
      }
      m.setIcon(icon(cls, t.bearing, stale));
      m.setZIndexOffset(cls === 'severe' ? 300 : cls === 'warning' ? 200 : 0);
      m.options.title = `Train ${t.train || id}: ${label}`;
      m.getElement()?.setAttribute('title', m.options.title);
      m.setPopupContent(popup(t, label, isNaN(ageMs) ? Infinity : ageMs));
    }
    for (const [id, m] of markers) if (!seen.has(id)) { layer.removeLayer(m); markers.delete(id); }
    const status = data.upstream === 'no-key' ? ' (demo data)' : data.upstream === 'error' ? ' (upstream error, may be stale)' : '';
    trainNote.textContent = `${markers.size} trains on the map (arrows), ${counts.late} late ≥ ${minutes} min, ${counts.canceled} canceled${status}`;
  }

  async function poll() {
    if (!map.hasLayer(layer) || document.hidden) return;
    try {
      const r = await fetch(`${API}?displayId=${encodeURIComponent(document.body.dataset.displayId || '')}`, { cache: 'no-store' });
      if (r.status === 404) { trainNote.textContent = 'Live train positions are not switched on yet'; return; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      draw(await r.json());
    } catch (e) {
      trainNote.textContent = `Train positions not available (${e.message})`;
    }
  }

  document.addEventListener('visibilitychange', poll);
  poll();
  setInterval(poll, POLL_MS);
})();
