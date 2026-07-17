# HANDOVER — Money Lens Interactive App
**The single source of truth for a fresh chat picking up this app.**
Last updated 2026-07-17. Read this whole file first, then `README.md` (quickstart), then —
only if you need the deeper research context — `../HANDOVER.md` (project) and
`../01_Dream_Ledger/Synthesis/READING_GUIDE.md` + `VISUALIZATION_HANDOVER.md`.

---

## 0. Thirty-second orientation
- **What:** a public webpage that turns seven synthetic Lagos "dream ledgers" into interactive,
  animated data-viz + a shock simulator + a 1,000-household 3-D city timelapse on a real Lagos map.
- **Where it sits:** it is chapter **Subtraction 07 — The Dream Ledger** of Lex te Loo's
  *Subtractive City* research (subject city: Lagos; "money is the lens"). The pipeline is
  **spreadsheet/ledgers → visuals → app**; this folder is the *app*.
- **Live:** https://emmanuelajibade751-beep.github.io/dream-ledger/
- **Stack:** vanilla ES modules, **D3 v7** for 2-D charts, **three.js r160** for the 3-D city.
  No build step, no framework. Static files served as-is.
- **Status:** Phases 0–4 DONE (+4b timelapse, +4c real map, + guided tour). Phase 5 (spatial
  simulation) is next.

---

## 1. Ownership & boundaries (do not skip)
This folder (`06_Interactive_App/`) is owned by the **interactive-app chat**. A DIFFERENT chat owns
`../01_Dream_Ledger/Synthesis/` and the canonical generators `../engines/build_*.py`
(see `../01_Dream_Ledger/Synthesis/OWNERSHIP.md`). Rules:
- This app **only READS** the ledgers in `../engines/outputs/*.xlsx`. It never edits Synthesis
  files or `build_*.py`.
- The two NEW persona generators we added (`generate_coping_control_ledger.py`,
  `generate_dollar_earner_ledger.py` + their specs) live in `../engines/` as **new files** —
  no owned file was modified. A proposal note documenting them for the owner chat is at
  `../01_Dream_Ledger/Synthesis/PROPOSED_new_personas.md`.
- If you need a change to a canonical visual/generator, route it through the owner chat or leave
  a `PROPOSED_*.md`. Do not edit their files.

---

## 2. How to run, regenerate, and deploy

### Run locally
```
cd 06_Interactive_App
py -3 serve.py            # serves this folder; reads PORT env or defaults to 4173
# open http://localhost:4173
```
`serve.py` MUST stay at the app root — `.claude/launch.json` (in the Kaggle working dir) launches
it by its Windows 8.3 short path `...\06_INT~1\serve.py`. The preview harness assigns a PORT; the
space in "LLL Laboratory" breaks naive `python -m http.server` invocations, which is why serve.py
exists.

### Regenerate the data (only when ledgers or map change)
```
cd 06_Interactive_App
PYTHONIOENCODING=utf-8 py -3 build/export_data.py       # ledgers -> data/*.json  (fast, deterministic)
PYTHONIOENCODING=utf-8 py -3 build/fetch_lagos_map.py   # OSM -> data/lagos_map.json  (network; Overpass rate-limits)
```
`PYTHONIOENCODING=utf-8` is REQUIRED — the naira sign breaks under Windows cp1252.

### Deploy (public GitHub Pages)
```
cd Money_Lens                      # git repo root (Money_Lens/, not this subfolder)
git add -A && git commit -m "..."
git branch -D deploy 2>/dev/null
git subtree split --prefix=06_Interactive_App -b deploy
git push app deploy:gh-pages --force
```
- `app` remote = https://github.com/emmanuelajibade751-beep/dream-ledger.git (PUBLIC, app only).
- The Money_Lens repo itself is **local** (main branch); the research is NOT pushed anywhere public.
- Pages rebuilds in ~30–60s. Verify with:
  `curl -s -o /dev/null -w "%{http_code}" https://emmanuelajibade751-beep.github.io/dream-ledger/`
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` (house style).

---

## 3. Folder structure (arranged 2026-07-17)
```
06_Interactive_App/
├── HANDOVER.md          ← this file (start here)
├── README.md            ← quickstart + phase-status log
├── index.html           ← single page; loads d3, then the js/ modules; importmap for three.js
├── serve.py             ← dev static server (PORT-aware). MUST stay at root (launch.json).
├── css/
│   └── style.css        ← all styling. Dark editorial theme; CSS vars at top.
├── js/                  ← load order matters (see index.html bottom)
│   ├── app.js           ← boot + Phase 1 climb chart + shared helpers (state, fmtNaira)
│   ├── simulator.js     ← Phase 3 seven-life simulator + THE SHOCK ENGINE (window.ML_EVENTS)
│   ├── heatmap.js       ← Phase 2 life-in-weeks heatmap
│   ├── artifacts.js     ← Phase 2 Menzel artifact boards (treemap)
│   ├── tour.js          ← guided tour / story mode (6 stops; drives the real controls)
│   └── population.js    ← Phase 4 three.js city + timelapse + real map (ES module)
├── data/                ← GENERATED — do not hand-edit
│   ├── index.json       ← persona list (key, name, color) for card order
│   ├── <persona>.json   ← 7 files: monthly series, milestones, weeks, artifacts, story/caveat
│   └── lagos_map.json   ← OSM geometry (ocean, water, roads, rail, lga, hoods) in map units
└── build/               ← dev-only data pipeline (not needed at runtime)
    ├── export_data.py       ← ledgers (../../engines/outputs/*.xlsx) -> data/<persona>.json
    └── fetch_lagos_map.py   ← OpenStreetMap Overpass -> data/lagos_map.json
```
`js/` load order in `index.html`: d3 → app.js → simulator.js → heatmap.js → artifacts.js →
(importmap) → population.js (module). `app.js`'s boot calls each `window.initX()` after data loads
and publishes `window.state` (which `population.js` reads). `simulator.js` publishes
`window.ML_EVENTS` (the shock config) which `population.js` reuses.

---

## 4. The cast — seven personas (the corpus)
Each dream ← a *withdrawn guarantee* (the thesis spine). Colours are validated categorical slots;
**green/red are reserved** for the grammar (green=dream, red=leak, grey=surviving) and never used
for persona identity. Neighborhoods are real (used on the map).

| key | Name | Person / place | Outcome | Colour | Scale | Neighborhood |
|---|---|---|---|---|---|---|
| `coping_control` | The Control | Mama Bisi household, kiosk+okada | no dream (baseline) | `#98958a` grey | ends ₦124k | Mushin |
| `landlord` | The Landlord | Tunde, technician+POS | reached cleanly (92.6%) | `#3987e5` blue | ₦33m | Ikorodu |
| `japa` | The Japa Dream | Chidinma, bank teller | departed, drained | `#199e70` aqua | ₦26m | Yaba |
| `ama` | AMA "Make It" | Tunde Balogun, dispatch rider | FAILS (−₦19k) | `#d95926` orange | ₦12m | Agege |
| `kids_abroad` | Kids Abroad | Adeyemi household, UK degree | reached at ruin | `#9085e9` violet | ₦102m | Gbagada |
| `instagrammer` | The Instagrammer | Zizi, aspiring influencer | stays a projection (222:1) | `#d55181` magenta | ₦30m real / ₦242m facade | Lekki |
| `dollar_earner` | The Dollar Earner | Deji, remote dev (USD) | winning in dollars | `#c98500` yellow | ₦48m / ₦15m dream | Surulere |

The last two are the simulator personas we added in Phase 3:
- **Control** — 17,349 rows, ZERO Dream rows by design; the baseline shocks are measured against.
- **Dollar Earner** — USD salary at a stylised ₦360→₦1,550 rate; the one archetype for whom a
  **currency collapse is a stabilizer** (naira income multiplies). Makes shocks two-sided.

Specs+generators: `../engines/{COPING_CONTROL,DOLLAR_EARNER}_SPEC.md` +
`generate_{coping_control,dollar_earner}_ledger.py`. The other five predate this app.

---

## 5. The data model (what's in each JSON)
Produced by `build/export_data.py` reading the 7 workbooks' sheets (Monthly_Summary, Weekly_Summary,
Dream_Progress, Daily_Ledger). Each `data/<persona>.json` has:
- **`key,name,person,dream,outcome,outcome_label,color,story,caveat`** — identity + the honest
  per-persona captions surfaced in the "How to read this" panels (owner asked for these = "flag 4").
- **`start_month`**, **`monthly[]`** — one row per month: `{m, date, income, essential, coping,
  dream, savings, diversion, social, balance, dream_cum}` (₦; expenses negative). This is the
  spine the charts and the whole simulator run on.
- **`milestones[]`** — from Dream_Progress: `{m, date, age, item, note, ngn, pct}`. The hover dots.
- **`weeks[]`** — per-week `{score, dream, leak, dreamItem, leakItem, milestone?}` for the heatmap
  (score = canonical dream-vs-leak formula from READING_GUIDE §1).
- **`artifacts[]`** — Menzel tiles: `{label, icon, kind(dream|leak|coping), total, count, first, last}`.
  Groupings per persona in `ARTIFACT_RULES` inside export_data.py — extend there if items change.

`data/lagos_map.json` (from `build/fetch_lagos_map.py`): `{attribution, bbox_units, ocean[], water[],
roads_major[], roads_minor[], rail[], lga[], hoods{key:{label,x,z}}}`. All geometry already projected
to the app's map units (~2.48 units/km, x=east, z=south). `hoods` gives each persona district its
true-coordinate anchor.

---

## 6. Phase-by-phase, what exists (PAST)

### Phase 0 — data export ✅
`build/export_data.py`. Produces everything in §5. Deterministic; safe to re-run. Landlord tile
totals were cross-checked against VISUALIZATION_HANDOVER §4 (Cement ₦1.93m ×106, Betting ₦0.99m ×1,110).

### Phase 1 — the interactive climb ✅ (`js/app.js`)
Overlay of all seven cumulative-dream lines on one journey-aligned axis. Click a persona **card**
(or the line, or the "why does this rocket?" hint) to focus that life on its own scale; milestone
dots appear with hover popups (item, note, date, age, ₦, % of own target); crosshair tooltip lists
every series at a month; a **dream-vs-balance** metric toggle; per-persona honesty captions;
a milestones **table view** (accessibility — everything hover shows, without hovering).
Key answer baked into the Kids-Abroad caption: **the rocket is the naira collapse inflating a
GBP-priced degree, NOT compounding.**
Shared helpers other modules use live here: `window.state` (all persona data), `fmtNaira()`,
`PERSONA_ORDER`.

### Phase 2 — meaningful cubes ✅ (`js/heatmap.js`, `js/artifacts.js`)
- **Heatmap:** life-in-weeks, seven personas stacked, row=year / square=week, coloured by the
  dream-vs-leak score. Hover → verdict + dream ₦/top item + leak ₦/top item; milestone weeks ringed.
- **Artifact boards:** Menzel "everything the money bought" as a d3.treemap, **for all seven**
  (the four originally-missing ones built here as interactives; canonical SVGs untouched).
  Tile area = naira; green = became the dream, red = leak, grey = coping (Control's board shows what
  *survival* bought). Hover → total, count, date range, share. Persona tabs + global focus drive it.

### Phase 3 — the shock/stabilizer simulator ✅ (`js/simulator.js`) — **the heart**
Seven lines, dashed = unshocked baseline, solid = shocked. Pick any combination of **6 shocks +
6 stabilizers**, choose the hit-year (slider), read the two metrics (real-terms dream vs bank
balance). Below: a **verdict card per persona** and a plain-language **"what changed and why"** panel.

THE ENGINE (also reused by Phase 4 — understand this once):
- Each event is an entry in `EVENTS` (exposed as `window.ML_EVENTS`). It carries `base` multipliers
  and per-persona `per` overrides on these fields: `income, essential, coping, leak, dreamSpend,
  dreamCost` (all default 1), plus `oneOff` (fraction of balance added/taken at the hit month) and a
  `window` (months the effect lasts; `Infinity` = permanent from hit).
- For each persona, each month: scale that month's real ledger by the active multipliers; **dream
  spending scales with "capacity"** = surplus left after surviving (windfalls speed dreams up,
  squeezes slow them); **hard-pause** the dream when balance is deep in debt (< −2× avg essentials);
  progress accumulates as `dreamSpend / dreamCost` — so a currency collapse can make a line rise in
  naira while falling in **real terms** (what it can buy). That real-terms axis is the whole point.
- Verdicts: thrives / holds the line / wounded / the dream dies (+ a Control special-case:
  sinking / surviving / breathing easier).
- The six shocks: `currency_collapse, subsidy_removed, power_collapse, cash_crunch, ponzi_wave,
  platform_crackdown`. The six stabilizers: `subsidy_back, ajo_payout, remittance_wave, rent_income,
  viral_breakthrough, stable_naira`. Note **subsidy** appears on both sides (removal = shock,
  presence = stabilizer — same lever, two directions), per owner decision. **viral_breakthrough**
  is the creator-winner path ("for every winner, a million losers", shown both ways).
- Verified: currency collapse alone → Kids Abroad −52% (dies), Dollar Earner +110% (thrives);
  viral breakthrough → Instagrammer +₦31m.

### Phase 4 — the population of 1,000 ✅ (`js/population.js`, ES module)
1,000 deterministic (seeded) procedural households sampled around the seven archetypes
(mix: 350 control / 250 AMA / 120 landlord / 120 japa / 80 insta / 60 kids / 20 dollar). Each gets
per-agent jitter: earnings ×0.7–1.4, cost ×0.8–1.25, ambition ×0.75–1.35, discipline (leak) ×0.4–1.9.
Runs the SAME shock engine (`ML_EVENTS`). Rendered as a three.js **InstancedMesh** block-city:
- **height** = ABSOLUTE naira built into the dream, one city-wide sqrt scale (`CITY_UNIT` ≈ the
  Landlord's ₦13.3m house = 1.0) — so a ₦700k hustle stays honestly short and the ₦66m degree towers.
- **colour** = that month's status: green build / bright-green surge / gold ARRIVED / red leak /
  grey survive / dark DEAD / deep-red drowning.
- gold "arrived" is restricted to archetypes that can complete by spending
  (`CAN_COMPLETE = landlord, japa, kids_abroad, dollar_earner`); AMA's target is a balance he never
  reaches and Zizi's dream is a projection, so they cannot "arrive" by spending.
- dream death = 15 consecutive paused months (sticky).
Live counts (completed / building / surviving / leaking / dead / drowning), raycast hover tooltips.
Verified: baseline ends **163 completed / 7 dead / 146 drowning**; currency collapse →
**20 completed / 28 dead / 252 drowning**, Dollar district completes EARLY.

### Phase 4b — cinematic timelapse ✅ (in `population.js`)
~50s run at 1× (`MONTH_MS = 600`) with **0.5×/1×/2×** speed chips; heights & colours **tween
continuously** (smoothstep) instead of snapping; **YEAR chyron**; at the hit-month an event
**banner** + **0.4× dramatic slowdown** + a coloured **ripple** sweeping west→east; **death slump**
and **completion glow**; **ending summary card** with replay; **auto-orbit** camera that yields the
moment the user grabs it. Honors `prefers-reduced-motion` (no autoplay/orbit/ripple).

### Phase 4c — real OSM map + layers ✅ (`build/fetch_lagos_map.py`, `population.js`)
Replaced the hand-drawn silhouette with **real OpenStreetMap geometry**: Atlantic coastline→ocean
polygon, lagoon/creek water, motorway/trunk/primary roads, rail, LGA boundaries — pulled via the
Overpass API, RDP-simplified, projected, saved to `data/lagos_map.json` (~52 KB). Districts sit at
their **true coordinates**. Toggle chips: **Roads / Rail / LGA boundaries / Neighborhoods** (ocean +
water always on). Attribution © OpenStreetMap contributors (ODbL) shown in the UI fine print.
Re-fetch: `py -3 build/fetch_lagos_map.py` (Overpass rate-limits — the script retries across two
endpoints; a 429 mid-run is usually harmless as it falls back).

### Guided tour / story mode ✅ (`js/tour.js`, 2026-07-17)
Six stops in PAGE order (which differs from phase numbering): cast → climb (focuses Kids Abroad,
the rocket) → life-in-weeks (the Control's grey wall vs AMA's red wall) → simulator (toggles
currency collapse ON — the two-sided finding) → city (resets, arms the same shock, presses play;
the ripple lands at year 3) → artifact boards (closing). Started via the masthead's
"▶ Take the tour" button. Design decisions worth knowing:
- The tour drives the app's REAL controls (persona-card clicks, `.sim-btn[data-id]` chips,
  `#popPlay`) so it exercises normal code paths; ending it anywhere leaves an explorable page.
- Same boot-race pattern as population.js: self-inits if `window.state` is already populated,
  else waits for `boot()` to call `window.initTour()` (idempotent).
- **Do not focus the Next button on step changes** — spacebar is a scroll key, and a focused
  button turns every space-scroll into an accidental step-skip (bug found in verification).
  Arrow keys navigate via a document-level handler; Esc ends the tour.
- Sections carry ids now (`sec-climb`, `sec-weeks`, `sec-sim`, `sec-city`, `sec-objects`) —
  also the groundwork for deep-linking.
- `population.js` chips carry `data-id` (added for the tour, matching simulator.js buttons).
- Reduced-motion: no smooth scroll, no autoplay at the city stop (copy invites pressing Play).

---

## 7. What's next (FUTURE)

### Phase 5 — the spatial city (the big one)
Turn the map from **context into mechanics** — right now a household in Agege doesn't behave
differently *because* it's in Agege. Make geography matter:
- **Completed dreams become persistent buildings** on the map (a finished Landlord = a house that
  stays; enough Kids-Abroad completions = a visible "remittance house" cluster). The city
  *accumulates* — "when the dreams die, the city keeps the dead body" (the thesis line). Dead dreams
  could leave artifacts: uncompleted-building shells, betting-kiosk tiles.
- **Location-specific shocks:** flooding hits waterside blocks (Lekki/lagoon edge) harder; a market
  fire hits a commercial cluster; rent gradients by district.
- **Community mechanics:** ajo/esusu and cooperative loans *between neighbors* — does pooling
  accelerate a district's dreams or just move risk around? Collective structures (a school, a
  borehole) appearing when enough households in an area succeed.
- **Candidate tech:** the current three.js layer can carry most of this; **deck.gl** is the
  documented candidate if it grows into a true geographic/GIS simulation. Keep the shock engine
  persona-generic so Phase 5 rules layer on top rather than replace it.

### Smaller, high-value items (can slot in any time)
- **Deep-link / shareable state** — encode active shocks + hit-year + focus in the URL hash so a
  specific scenario can be sent as a link. (The tour added section ids — half the groundwork.)
- **Mobile pass** — the 3-D city and control rows need a narrow-screen once-over.
- **Follow-the-Billionaire (`../02_...`) and the other stubs** — separate chapters, not yet apps.

### Article / comms (owner task, non-code)
The findings for a LinkedIn/site article already exist in `../01_Dream_Ledger/Synthesis/
SYNTHESIS_MATRIX.md`. Suggested spine: the seven lives → the two-sided shock finding (Kids Abroad
vs Dollar Earner) → the city timelapse (only ~1 in 6 dreams completes even with no shock).

---

## 8. Conventions & gotchas (read before editing)
- **Honesty rules (carried from Synthesis):** green=dream / red=leak / grey=surviving, always;
  persona identity colours never reuse green/red; **% of target is never compared across personas**
  (different target definitions — say so in copy); data is synthetic & **illustrative, not
  predictive** — the simulator must say so on screen; keep volume visible (never crush a life to two
  bars — the "overlay_prototype" failure the Synthesis docs warn about).
- **Untrusted-text rule:** persona/item/milestone strings come from the ledgers — always inserted
  via `textContent`/`createTextNode`, never `innerHTML` string concatenation (see tooltips).
- **Palette is validated:** the 7 identity colours pass colourblind + dark-contrast checks (worst
  adjacent CVD ΔE 27.6). The Control's grey is a deliberate low-chroma exception, mitigated by a
  dashed line + direct labels. If you change a colour, re-validate with the dataviz skill's
  `validate_palette.js`.
- **Environment:** Windows; always `PYTHONIOENCODING=utf-8` for the python scripts (naira sign).
  Git may warn about LF→CRLF — harmless. The "LLL Laboratory" space is why `serve.py` exists and why
  `launch.json` uses the 8.3 short path.
- **three.js loads via importmap CDN** (jsdelivr, r160) — needs network at runtime. If offline/CSP
  blocks it, `population.js` catches the error and shows a graceful fallback message (the 2-D
  simulator still carries the same engine).
- **Deploy publishes the whole app folder** including `build/` and these docs — harmless, but know
  that the python scripts and this HANDOVER are public on gh-pages.

---

## 9. Fresh-chat quickstart (do this first)
1. Read this file top-to-bottom. Skim `README.md`.
2. `cd 06_Interactive_App && py -3 serve.py`, open the site, click through all four sections so you
   know what exists before changing anything.
3. Confirm the ownership boundary (§1) — do not touch `../01_Dream_Ledger/Synthesis/` or
   `../engines/build_*.py`.
4. Make changes in `js/` / `css/` / `index.html`; regenerate data only via `build/*.py`.
5. Verify in the browser (preview + console + a screenshot), then commit + `git subtree` redeploy (§2),
   then poll the live URL to confirm.
6. Update the Status log in `README.md` and the phase sections here when a phase lands.
```
```
