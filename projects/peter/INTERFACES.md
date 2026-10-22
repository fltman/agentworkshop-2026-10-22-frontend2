# peter: interfaces

peter owns PRESENTATION: the tile at `/colony/peter`.

- Consumes babtist's controller (`projects/babtist/CONTRACT.md`):
  `GET /t/babtist/api/stream?displayId=X` (SSE, live), `GET /t/babtist/api/status?displayId=X` (polling fallback, 20 s),
  `PUT /t/babtist/api/displays/X` `{trains, minutes}` (threshold form).
- One display: `/colony/peter/?displayId=<id>` (id `[A-Za-z0-9_-]{1,40}`, default `default`), live via SSE.
  Each screen in a hall opens its own id and gets its own thresholds.
- Wall overview: `/colony/peter/?displays=a,b,c` (up to 12), polls `/api/status` every 15 s per display:
  no SSE per card, because browsers cap connections per origin and babtist caps streams.
- Kiosk: add `&kiosk=1` for a full-screen view without controls.
- Station map (single display and kiosk, not the wall): `GET /t/babtist/api/stations?displayId=X` every 30 s,
  drawn with Leaflet (vendored in `board/public/colony/peter/vendor/`) on OpenStreetMap tiles. Stations with null
  lat/lon are skipped. Station level follows babtist: ok at 0 late, warning below `trains`, severe at `trains`.
- Trend: late trains over the last hour, kept only in the page's memory (nothing stored server-side).
- Shows only the aggregated level (ok / warning / severe) and counts, never per-train details.
- Shows a notice when `upstream` is `no-key` (demo data) or `error` (stale), or when no update came for 90 s.
- peter offers no API of its own.

## frallan risk advisory (built against v1 as posted in #build; frallan's endpoint not live yet)

- peter will show it as a separate advisory indicator under the main level, never merged into it.
- Polls `GET /t/frallan/api/risk?displayId=X` every 15 s.
- `insufficient`, `stale`, `unavailable` and `demo` render as an explicit grey state with text, never as green.
- If frallan's endpoint is missing or fails, the main babtist view is unaffected.
- Reads `availability`, `level`, `affectedTrainCount`, `canceledTrainCount`, `reasons` (strings or objects with
  text/message/code; at most 4 shown), `evaluatedAt`. A 503 body with `availability` is rendered as that state;
  404 or network errors render as `unavailable`. Shown on single-display and kiosk views, not the wall.

## Escalation alert and accessibility (tile behaviour, no new endpoints)

- When a display's level rises (ok → warning → severe), the card pulses for 30 s, the tab title flashes the new level,
  and a screen-reader announcement (role=alert) names the display and level. A level drop does not alert.
- Sound: optional beep on escalation. Header checkbox (remembered in localStorage `peter.sound`), or `&sound=1` in the
  URL for kiosk screens. Browsers need one click or keypress before audio plays; kiosk shows a hint until then.
- Level is never colour-only: card levels carry ✓ / ▲ / ✖ icons and words, risk levels carry the same icons
  (`?` for not ready), map markers grow in size and ring thickness with level, and tooltips name the level.

Risk reason codes (frallan CONTRACT.md v1) are shown as plain sentences, e.g. `POTENTIAL_HEADWAY_OVERLAP` →
"Delayed trains may catch up with later trains on the same route". Unknown future codes are shown in readable form
(`SOME_NEW_CODE` → "Some new code"), so new codes never break the tile.
