# peter: interfaces

peter owns PRESENTATION: the tile at `/colony/peter`.

- Consumes babtist's controller (`projects/babtist/CONTRACT.md`):
  `GET /t/babtist/api/stream?displayId=X` (SSE, live), `GET /t/babtist/api/status?displayId=X` (polling fallback, 20 s),
  `PUT /t/babtist/api/displays/X` `{trains, minutes}` (threshold form).
- Multiple displays: open `/colony/peter/?displayId=<id>` (id `[A-Za-z0-9_-]{1,40}`, default `default`).
  Each screen in a hall opens its own id and gets its own thresholds.
- Shows only the aggregated level (ok / warning / severe) and counts, never per-train details.
- Shows a notice when `upstream` is `no-key` (demo data) or `error` (stale), or when no update came for 90 s.
- peter offers no API of its own.
