# 06_Interactive_App — Money Lens, the interactive layer

The webpage version of the Dream Ledger: interactive D3 charts, a shock/stabilizer simulator, and
a 1,000-household 3-D city timelapse on a real Lagos map. Part of **Subtraction 07** (Lex te Loo's
*Subtractive City* research; "money is the lens"). Pipeline: ledgers → visuals → app.

> **New here / picking this up in a fresh chat? Read [`HANDOVER.md`](HANDOVER.md) first** —
> it documents every phase, the data model, the shock engine, the deploy flow, the ownership
> boundary, and what's next. This README is just the quickstart.

**Live:** https://emmanuelajibade751-beep.github.io/dream-ledger/

## Run locally
```
cd 06_Interactive_App
py -3 serve.py            # PORT-aware static server; defaults to 4173
# open http://localhost:4173
```
`serve.py` must stay at the app root (launch.json launches it). No build step; edit `js/`,
`css/`, `index.html` and reload.

## Regenerate data (only when ledgers or the map change)
```
PYTHONIOENCODING=utf-8 py -3 build/export_data.py       # ledgers -> data/*.json (fast)
PYTHONIOENCODING=utf-8 py -3 build/fetch_lagos_map.py   # OpenStreetMap -> data/lagos_map.json (network)
```

## Deploy (public GitHub Pages, app only)
```
cd ..                                                   # Money_Lens repo root
git add -A && git commit -m "..."
git branch -D deploy 2>/dev/null
git subtree split --prefix=06_Interactive_App -b deploy
git push app deploy:gh-pages --force
```

## Structure
```
index.html · serve.py · css/style.css
js/   app.js (climb + boot) · simulator.js (shock engine) · heatmap.js · artifacts.js · population.js (3-D city)
data/ <persona>.json · index.json · lagos_map.json          (GENERATED — see build/)
build/ export_data.py · fetch_lagos_map.py                  (dev-only data pipeline)
```

## Status
| Phase | What | State |
|---|---|---|
| 0 | Data export (`build/export_data.py`) | ✅ |
| 1 | Interactive climb chart (`app.js`) | ✅ |
| 2 | Life-in-weeks heatmap + Menzel artifact boards (`heatmap.js`, `artifacts.js`) | ✅ |
| 3 | Shock/stabilizer simulator + 2 new personas (`simulator.js`) | ✅ |
| 4 | Population of 1,000 — three.js city (`population.js`) | ✅ |
| 4b | Cinematic ~50s timelapse (speeds, chyron, banner, ripple, end card) | ✅ |
| 4c | Real OSM Lagos map with toggleable layers (`build/fetch_lagos_map.py`) | ✅ |
| 5 | The spatial city — geography as mechanics (persistent buildings, local shocks, community loans) | ⬜ next |

Full detail for every phase, plus the "what's next" proposals, is in [`HANDOVER.md`](HANDOVER.md) §6–7.

## Ownership
This folder only READS `../engines/outputs/*.xlsx`. It never edits `../01_Dream_Ledger/Synthesis/`
or `../engines/build_*.py` (owned by another chat — see that folder's `OWNERSHIP.md`). The two new
persona ledgers we added are NEW files in `../engines/`; a note for the owner chat is at
`../01_Dream_Ledger/Synthesis/PROPOSED_new_personas.md`.

## Honesty rules (carried from Synthesis)
Green = dream, red = leak, grey = surviving; identity colours never reuse green/red. "% of target"
is never compared across personas. Data is synthetic and illustrative, not predictive — the app
says so on screen. Volume stays visible; nothing gets crushed to two bars.
