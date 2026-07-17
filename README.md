# 06_Interactive_App — Money Lens, the interactive layer
**Created 2026-07-16.** Owned by the interactive-app chat (separate from the Synthesis folder's
owner chat — see `../01_Dream_Ledger/Synthesis/OWNERSHIP.md`). This folder only READS the canonical
ledgers and never edits `Synthesis/` or `engines/build_*.py`.

## What this is
The webpage version of the Dream Ledger visuals — interactive, animated, and eventually a
simulator. Stack decision: **D3.js for the 2D charts** (this phase), **three.js for the block-world /
population / city layers** (later phases). Static server, no build step. Fonts: Space Grotesk + Inter.

## Live site
**https://emmanuelajibade751-beep.github.io/dream-ledger/** — public GitHub Pages, serving the
`gh-pages` branch of `emmanuelajibade751-beep/dream-ledger` (app files only; the research repo
stays local/private). Redeploy after changes:
```
cd Money_Lens
git add -A && git commit -m "..."
git branch -D deploy 2>/dev/null; git subtree split --prefix=06_Interactive_App -b deploy
git push app deploy:gh-pages --force
```
(`app` remote = https://github.com/emmanuelajibade751-beep/dream-ledger.git)

## Run it
```
cd 06_Interactive_App
PYTHONIOENCODING=utf-8 py -3 export_data.py   # refresh data/ from ../engines/outputs/*.xlsx
py -3 -m http.server 4173 --directory .        # then open http://localhost:4173
```

## Status
- **Phase 0 — data export: DONE.** `export_data.py` → `data/{persona}.json` (monthly series,
  milestones, weekly dream-vs-leak pulse) + `data/index.json`.
- **Phase 1 — interactive climb: DONE.** `index.html` + `js/app.js`:
  overlay of all five dream lines (journey-aligned), click a persona card (or the rocket hint)
  to focus one life on its own scale, milestone dots with hover popups (item, note, date, age,
  ₦, % of own target), crosshair tooltip, dream-vs-balance metric toggle, per-persona honesty
  captions (flag 4), milestones table view. Persona palette validated (CVD ΔE 27.6, ≥3:1 on dark).
  Answer to "why does one line rocket": Kids Abroad — the naira collapse (₦460→₦2,050/£)
  inflating GBP-priced tuition, NOT compounding. It is written into the focus caption.
- **Phase 2 — meaningful cubes: DONE (2026-07-16).**
  - `js/heatmap.js` — interactive life-in-weeks heatmap, all five personas stacked, journey-aligned
    (row = year, square = week). Hover any week → verdict ("The dream won this week"), dream ₦ +
    top dream item, leak ₦ + top leak item; milestone weeks carry a white ring with the milestone
    named in the hover. Colors are the canonical score buckets restated for the dark surface
    (green kept lighter than red so the pair differs in luminance too).
  - `js/artifacts.js` — Menzel artifact boards for ALL FIVE personas (the four missing ones now
    exist, as interactives; canonical SVG generators untouched per OWNERSHIP.md). d3.treemap,
    tile area = naira; green = became the dream, red = the leak among them; icons + counts on
    tiles; hover → total, purchase count, date range, share of board. Tabs switch persona and the
    global focus (cards / heatmap labels) drives the board.
  - `export_data.py` grew `build_weeks()` (per-week dream/leak + top items + milestone weeks) and
    `build_artifacts()` (per-persona item groupings in `ARTIFACT_RULES` — extend there for the two
    new personas). Landlord tile totals verified against VISUALIZATION_HANDOVER §4 (Cement ₦1.93m
    ×106, Betting ₦0.99m ×1,110).
- **Phase 3 — shocks & stabilizers: DONE (2026-07-16).**
  - **Two new personas built** (new files in `engines/`, owned files untouched; proposal note
    left at `../01_Dream_Ledger/Synthesis/PROPOSED_new_personas.md`):
    `Coping_Control` (17,349 rows, zero Dream rows, ends ₦124k — the grey wall) and
    `Dollar_Earner` (4,303 rows, USD salary @ ₦360→₦1,550, ends ₦48.4m + ₦15m dream).
    Cast is now SEVEN; palette re-validated (grey Control is a deliberate chroma exception,
    mitigated by its dashed stroke + direct labels; CVD worst-pair ΔE 27.6).
  - **`js/simulator.js`** — 6 shocks (currency collapse, subsidy removed, grid collapse,
    cash crunch, ponzi wave, platform crackdown) + 6 stabilizers (subsidy, ajo payout,
    remittance wave, asset income/rent, viral breakthrough, stable naira), multi-combinable,
    hit-year slider. Engine: category multipliers + real-terms dreamCost + capacity coupling
    (dream spend scales with post-survival surplus) + hard pause when deep in debt +
    one-off balance bites. Verdicts per persona (thrives / holds / wounded / dream dies /
    control special-case) + "what changed and why" notes from per-persona config.
  - Verified: currency collapse alone → Kids Abroad dream −52% (dies), Dollar Earner +110%
    (thrives) — the two-sided design goal; viral breakthrough → Instagrammer thrives +₦31m
    (the creator-winner path).
  Original Phase-3 decisions (kept for reference):
  - Shocks: currency collapse, **removal of subsidy** (fuel / electricity / general), power-grid
    collapse, cash crunch (naira redesign), betting/Ponzi crash, platform demonetization, rent/flood.
  - Stabilizers: **subsidy** (the mirror of its removal — same lever, two directions), ajo/esusu
    payout, diaspora remittance windfall, asset-income compounding (rent), viral moment/brand deal,
    stable naira.
  - **Creator-breakthrough note (owner):** Instagrammers/YouTubers DO get wealthy in reality —
    the simulator must include the breakthrough path (viral/brand-deal stabilizer flips Zizi's
    archetype to the winner case: "for every winner, a million losers" shown both ways).
  - **Two new personas to build for the simulator** (spec + generator in `../engines/`, same
    pattern as the existing five):
    1. **Coping-only control** — no dream; all surplus eaten by generator/pure-water/security/rent
       advance (already sketched in `_persona_placeholders/NEXT_PERSONAS.md` item 5). The baseline
       that shocks are measured against — "let the ones without a dream die."
    2. **Dollar-earner** — remote worker/freelancer earning USD from Lagos. The one archetype for
       whom currency collapse is a STABILIZER (naira income quadruples). Makes shocks two-sided.
- **Phase 4c — real OSM map layers: DONE (2026-07-17).** `fetch_lagos_map.py` pulls live
  geometry from Overpass (coastline→ocean polygon, lagoon/creek water, motorway/trunk/primary
  roads, rail, LGA boundaries) → `data/lagos_map.json` (52 KB; RDP-simplified, projected to
  map units, ~2.48 units/km, bbox 6.36–6.70N 3.10–3.65E). Layers render as toggle chips
  (Roads / Rail / LGA boundaries / Neighborhoods); ocean+water always on. District anchors
  are true OSM coordinates. Attribution: © OpenStreetMap contributors (ODbL), shown in UI.
  Re-fetch any time: `PYTHONIOENCODING=utf-8 py -3 fetch_lagos_map.py` (Overpass rate-limits;
  script retries across two endpoints).
- **Phase 4b — cinematic Lagos timelapse: DONE (2026-07-17).** The population now plays on a
  stylized Lagos stage (hand-built mainland/lagoon/island-strip polygons in `population.js` —
  `MAINLAND`/`ISLAND_STRIP`; real neighborhoods, approximate positions): Mushin (control),
  Agege (AMA), Ikorodu (landlord), Yaba (japa), Gbagada (kids), Surulere (dollar), Lekki (insta).
  ~50s run at 1× (`MONTH_MS=600`) with 0.5×/1×/2× chips; continuous height/colour tweening;
  YEAR chyron; event banner + 0.4× dramatic slowdown + coloured ripple sweeping west→east at
  the hit month; death slump + completion glow; ending summary card with replay; auto-orbit
  that yields on user grab; honors prefers-reduced-motion (no autoplay/orbit/ripple).
- **Phase 4 — population of 1,000: DONE (2026-07-17).** `js/population.js` (ES module;
  three.js r160 via importmap CDN + OrbitControls). 1,000 deterministic procedural households
  sampled around the seven archetypes (mix: 350 control / 250 AMA / 120 landlord / 120 japa /
  80 insta / 60 kids / 20 dollar — "for every winner…"). Same shock engine (`ML_EVENTS` shared
  from simulator.js) + per-agent jitter (earnings 0.7–1.4×, ambition, discipline 0.4–1.9×).
  InstancedMesh block-city in 7 districts: height = ABSOLUTE naira built (city scale,
  Landlord's house ≈ 1.0), colour = month status (green build / gold arrived / red leak /
  grey survive / dark dead / deep-red drowning). Play/scrub timeline, own shock chips +
  hit-year, live counts, hover tooltips (raycast), persona-tinted floor plates.
  Design decisions: gold "arrived" only for archetypes that can complete by spending
  (landlord/japa/kids/dollar — AMA and Insta cannot); dream death = 15 consecutive paused
  months, sticky. Verified: baseline ends 163 completed / 7 dead / 146 drowning; currency
  collapse → 20 completed / 28 dead / 252 drowning, and the Dollar district completes EARLY.
- **Phase 5 — the city** (spatial; deck.gl candidate; community loans, collective structures).

## Honesty rules carried over from Synthesis
- Green = dream, red = leak, grey = surviving. Persona identity colors never reuse green/red.
- % of target is never compared across personas (different target definitions).
- Data is synthetic and illustrative, not predictive — the simulator must say so on screen.
- Volume stays visible; nothing gets crushed to two bars (the overlay-prototype failure).
