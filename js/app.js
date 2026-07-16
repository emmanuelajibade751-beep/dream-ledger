/* Money Lens — interactive Phase 1: the climbing lines + milestone hovers.
   Personas overlay on one journey-month axis; click a card (or the rocket hint)
   to enter one life: axis rescales to that life, milestones appear, hover explains
   the moment. All tooltip text is inserted via textContent (untrusted data rule). */

"use strict";

// Order is also legend adjacency (CVD-validated): the grey Control sits next to blue.
const PERSONA_ORDER = ["coping_control", "landlord", "japa", "ama", "kids_abroad",
                       "instagrammer", "dollar_earner"];

const METRICS = {
  dream_cum: {
    title: "The climb — what each dream accumulated",
    sub: "Journeys aligned at month 0. One of these lines rockets — click it to find out why.",
    reading:
      "Each line is one person's cumulative dream spending — money that physically became the " +
      "dream (cement, tuition, tickets, content). Steeper is not always better: a line can rise " +
      "because the dream is succeeding, or because the world made the same dream more expensive. " +
      "The dots are real milestones from each ledger.",
  },
  balance: {
    title: "The heart-rate monitor — each bank account, month by month",
    sub: "Up = money piling, down = draining. Below the dotted line = living in debt.",
    reading:
      "This is the bank balance, not the dream. A dip during a build is often cash becoming an " +
      "asset (“locked in concrete”). A line that never leaves the floor is honest: for " +
      "AMA and the Instagrammer, money simply never accumulates.",
  },
};

const state = {
  personas: {},   // key -> data
  focus: null,    // key or null
  metric: "dream_cum",
};

// Later-loaded modules (heatmap, artifacts) register here to react to focus changes.
const MLHooks = [];

/* ---------- formatting ---------- */
function fmtNaira(v) {
  const abs = Math.abs(v);
  let s;
  if (abs >= 1e6) s = (v / 1e6).toFixed(abs >= 1e7 ? 0 : 1) + "m";
  else if (abs >= 1e3) s = (v / 1e3).toFixed(0) + "k";
  else s = v.toFixed(0);
  return "₦" + s;
}

/* ---------- load ---------- */
async function loadAll() {
  const index = await (await fetch("data/index.json")).json();
  const loads = index.map(async (e) => {
    state.personas[e.key] = await (await fetch(`data/${e.key}.json`)).json();
  });
  await Promise.all(loads);
}

/* ---------- persona cards ---------- */
function buildCards() {
  const cast = document.getElementById("cast");
  for (const key of PERSONA_ORDER) {
    const p = state.personas[key];
    const btn = document.createElement("button");
    btn.className = "persona-card";
    btn.style.setProperty("--pc", p.color);
    btn.dataset.key = key;
    btn.setAttribute("aria-pressed", "false");

    const name = document.createElement("span");
    name.className = "pc-name";
    const sw = document.createElement("span");
    sw.className = "pc-swatch";
    name.appendChild(sw);
    name.appendChild(document.createTextNode(p.name));

    const person = document.createElement("span");
    person.className = "pc-person";
    person.style.display = "block";
    person.textContent = p.person;

    const chip = document.createElement("span");
    chip.className = "pc-chip chip-" + p.outcome;
    chip.textContent = p.outcome_label;

    btn.append(name, person, chip);
    btn.addEventListener("click", () => setFocus(state.focus === key ? null : key));
    cast.appendChild(btn);
  }
}

function updateCards() {
  document.querySelectorAll(".persona-card").forEach((btn) => {
    const on = state.focus === btn.dataset.key;
    btn.classList.toggle("is-focused", on);
    btn.classList.toggle("is-dimmed", state.focus !== null && !on);
    btn.setAttribute("aria-pressed", String(on));
  });
  document.getElementById("clearFocus").hidden = state.focus === null;
}

/* ---------- chart ---------- */
const W = 980, H = 520;
const MARGIN = { top: 24, right: 150, bottom: 42, left: 64 };
let svg, gGrid, gLines, gLabels, gMiles, gAxes, gHover, xScale, yScale;

function initChart() {
  svg = d3.select("#chart").append("svg")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("role", "img")
    .attr("aria-label", "Interactive chart of five dream trajectories over time");

  gGrid = svg.append("g");
  gLines = svg.append("g");
  gMiles = svg.append("g");
  gLabels = svg.append("g");
  gAxes = svg.append("g");
  gHover = svg.append("g");

  svg.on("pointermove", onPointerMove)
     .on("pointerleave", hideTooltip);
}

function seriesValues(p) {
  const f = state.metric;
  return p.monthly.map((r) => ({ m: r.m, v: r[f], date: r.date }));
}

function visibleKeys() {
  return state.focus ? [state.focus] : PERSONA_ORDER;
}

function render() {
  const metric = METRICS[state.metric];
  document.getElementById("chartTitle").textContent = metric.title;
  document.getElementById("chartSub").textContent = state.focus
    ? state.personas[state.focus].dream + " — " + state.personas[state.focus].person
    : metric.sub;
  updateReading();
  buildTable();

  const keys = visibleKeys();
  const maxM = d3.max(keys, (k) => state.personas[k].monthly.length - 1);
  let vMin = d3.min(keys, (k) => d3.min(seriesValues(state.personas[k]), (d) => d.v));
  let vMax = d3.max(keys, (k) => d3.max(seriesValues(state.personas[k]), (d) => d.v));
  if (state.metric === "dream_cum") vMin = Math.min(0, vMin);
  const pad = (vMax - vMin) * 0.06 || 1;

  xScale = d3.scaleLinear().domain([0, maxM]).range([MARGIN.left, W - MARGIN.right]);
  yScale = d3.scaleLinear().domain([vMin - pad, vMax + pad]).range([H - MARGIN.bottom, MARGIN.top]);

  const t = svg.transition().duration(650).ease(d3.easeCubicOut);

  /* grid + axes */
  const yTicks = yScale.ticks(6);
  gGrid.selectAll("line.gridline").data(yTicks, (d) => d)
    .join(
      (en) => en.append("line").attr("class", "gridline")
        .attr("x1", MARGIN.left).attr("x2", W - MARGIN.right)
        .attr("y1", yScale).attr("y2", yScale).attr("opacity", 0)
        .call((s) => s.transition(t).attr("opacity", 1)),
      (up) => up.call((s) => s.transition(t).attr("y1", yScale).attr("y2", yScale)),
      (ex) => ex.remove()
    );

  // dotted zero line + "in debt" label for the balance view
  gGrid.selectAll("line.zero-line").data(vMin < 0 ? [0] : [])
    .join("line")
    .attr("class", "zero-line")
    .attr("x1", MARGIN.left).attr("x2", W - MARGIN.right)
    .transition(t)
    .attr("y1", yScale(0)).attr("y2", yScale(0));
  gGrid.selectAll("text.debt-label").data(vMin < 0 ? [0] : [])
    .join("text")
    .attr("class", "debt-label")
    .attr("x", MARGIN.left + 4)
    .text("IN DEBT ↓")
    .transition(t)
    .attr("y", yScale(0) + 14);

  gAxes.selectAll("*").remove();
  gAxes.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${H - MARGIN.bottom})`)
    .call(d3.axisBottom(xScale)
      .tickValues(d3.range(0, maxM + 1, 12))
      .tickFormat((d) => (d === 0 ? "Month 0" : `Year ${d / 12}`))
      .tickSize(4));
  gAxes.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(${MARGIN.left},0)`)
    .call(d3.axisLeft(yScale).tickValues(yTicks).tickFormat(fmtNaira).tickSize(4));

  /* lines */
  const line = d3.line()
    .x((d) => xScale(d.m))
    .y((d) => yScale(d.v))
    .curve(d3.curveMonotoneX);

  gLines.selectAll("path.series-line").data(PERSONA_ORDER, (d) => d)
    .join((en) => en.append("path")
      .attr("class", "series-line")
      .attr("stroke", (k) => state.personas[k].color)
      // the Control is dashed — its greyness is semantic (no dream), the dash is
      // the secondary encoding that keeps it identifiable without color
      .attr("stroke-dasharray", (k) => (k === "coping_control" ? "7 5" : null))
      .attr("d", (k) => line(seriesValues(state.personas[k]))))
    .attr("tabindex", 0)
    .classed("is-ghost", (k) => state.focus !== null && k !== state.focus)
    .classed("is-hero", (k) => state.focus === k)
    .style("cursor", "pointer")
    .on("click", (ev, k) => setFocus(state.focus === k ? null : k))
    .transition(t)
    .attr("d", (k) => line(seriesValues(state.personas[k])));

  /* direct labels at line ends */
  gLabels.selectAll("text.series-label").data(PERSONA_ORDER, (d) => d)
    .join((en) => en.append("text").attr("class", "series-label"))
    .attr("fill", (k) => state.personas[k].color)
    .classed("is-ghost", (k) => state.focus !== null && k !== state.focus)
    .text((k) => state.personas[k].name)
    .transition(t)
    .attr("x", (k) => xScale(seriesValues(state.personas[k]).at(-1).m) + 8)
    .attr("y", (k) => {
      const y = yScale(seriesValues(state.personas[k]).at(-1).v);
      return labelDodge(k, y);
    });

  renderMilestones(t);
  renderRocketHint(t);
  hideTooltip();
}

/* keep end-labels from overlapping in overlay mode */
const labelSlots = {};
function labelDodge(key, y) {
  if (state.focus) return y;
  if (!labelSlots.order) {
    labelSlots.order = [...PERSONA_ORDER].sort((a, b) =>
      seriesValues(state.personas[a]).at(-1).v - seriesValues(state.personas[b]).at(-1).v);
  }
  // simple pass: nudge labels apart bottom-up by 14px if they collide
  if (!labelSlots.pos) labelSlots.pos = {};
  labelSlots.pos[key] = y;
  const sorted = labelSlots.order;
  const idx = sorted.indexOf(key);
  let yy = y;
  for (let i = sorted.length - 1; i > idx; i--) {
    const other = labelSlots.pos[sorted[i]];
    if (other !== undefined && Math.abs(yy - other) < 14) yy = other + 14;
  }
  labelSlots.pos[key] = yy;
  return yy;
}

/* ---------- milestones ---------- */
function renderMilestones(t) {
  const focused = state.focus;
  const data = focused
    ? state.personas[focused].milestones.map((ms) => ({ ...ms, key: focused }))
    : [];

  const yFor = (d) => {
    const row = state.personas[d.key].monthly[d.m];
    return yScale(row[state.metric]);
  };

  const dots = gMiles.selectAll("circle.milestone-dot").data(data, (d) => d.key + d.date);
  dots.join(
    (en) => en.append("circle")
      .attr("class", "milestone-dot")
      .attr("r", 0)
      .attr("fill", (d) => state.personas[d.key].color)
      .attr("stroke", "#1a1a19")
      .attr("stroke-width", 2)
      .attr("cx", (d) => xScale(d.m))
      .attr("cy", yFor)
      .call((s) => s.transition(t).delay((d, i) => 320 + i * 55).attr("r", 5.5)),
    (up) => up.call((s) => s.transition(t).attr("cx", (d) => xScale(d.m)).attr("cy", yFor)),
    (ex) => ex.transition().duration(200).attr("r", 0).remove()
  );

  // oversized invisible hit targets (≥24px) for reliable hover
  gMiles.selectAll("circle.milestone-hit").data(data, (d) => d.key + d.date)
    .join("circle")
    .attr("class", "milestone-hit")
    .attr("r", 14)
    .attr("cx", (d) => xScale(d.m))
    .attr("cy", yFor)
    .on("pointerenter", (ev, d) => showMilestone(ev, d))
    .on("pointermove", (ev, d) => showMilestone(ev, d))
    .on("pointerleave", hideMilestone)
    .on("focus", (ev, d) => showMilestone(ev, d))
    .on("blur", hideMilestone)
    .attr("tabindex", 0);
}

function showMilestone(ev, d) {
  hideTooltip();
  const pop = document.getElementById("milestonePop");
  pop.replaceChildren();

  const item = document.createElement("div");
  item.className = "mp-item";
  item.textContent = d.item;

  const meta = document.createElement("div");
  meta.className = "mp-meta";
  meta.textContent = `${d.date} · age ${d.age}`;

  const note = document.createElement("div");
  note.className = "mp-note";
  note.textContent = d.note;

  const ngn = document.createElement("div");
  ngn.className = "mp-ngn";
  ngn.textContent = "Dream asset: " + fmtNaira(d.ngn) + " ";
  const pct = document.createElement("span");
  pct.className = "mp-pct";
  pct.textContent = `(${d.pct.toFixed(1)}% of own target)`;
  ngn.appendChild(pct);

  pop.append(item, meta, note, ngn);
  pop.hidden = false;
  positionPop(pop, ev);
}

function hideMilestone() {
  document.getElementById("milestonePop").hidden = true;
}

/* ---------- rocket hint (the "why does this rise so fast?" entry point) ---------- */
function renderRocketHint(t) {
  const show = !state.focus && state.metric === "dream_cum";
  const hint = gHover.selectAll("text.rocket-hint").data(show ? [1] : []);
  hint.join(
    (en) => {
      const k = "kids_abroad";
      const last = seriesValues(state.personas[k]).at(-1);
      return en.append("text")
        .attr("class", "rocket-hint")
        .attr("x", xScale(last.m * 0.72))
        .attr("y", yScale(last.v * 0.72) - 14)
        .attr("opacity", 0)
        .text("↗ why does this line rocket? click it")
        .on("click", () => setFocus("kids_abroad"))
        .call((s) => s.transition(t).delay(500).attr("opacity", 1));
    },
    (up) => up,
    (ex) => ex.remove()
  );
}

/* ---------- crosshair tooltip ---------- */
function onPointerMove(ev) {
  if (!document.getElementById("milestonePop").hidden) return;
  const [px] = d3.pointer(ev);
  if (px < MARGIN.left || px > W - MARGIN.right) { hideTooltip(); return; }
  const m = Math.round(xScale.invert(px));

  const rows = visibleKeys()
    .map((k) => {
      const p = state.personas[k];
      const row = p.monthly[m];
      return row ? { k, name: p.name, color: p.color, v: row[state.metric], date: row.date } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.v - a.v);
  if (!rows.length) { hideTooltip(); return; }

  gHover.selectAll("line.crosshair").data([m])
    .join("line")
    .attr("class", "crosshair")
    .attr("x1", xScale(m)).attr("x2", xScale(m))
    .attr("y1", MARGIN.top).attr("y2", H - MARGIN.bottom);

  const tt = document.getElementById("tooltip");
  tt.replaceChildren();
  const dt = document.createElement("div");
  dt.className = "tt-date";
  dt.textContent = rows[0].date + "  ·  month " + m;
  tt.appendChild(dt);
  for (const r of rows) {
    const rowEl = document.createElement("div");
    rowEl.className = "tt-row";
    const key = document.createElement("span");
    key.className = "tt-key";
    key.style.background = r.color;
    const nm = document.createElement("span");
    nm.className = "tt-name";
    nm.textContent = r.name;
    const val = document.createElement("span");
    val.className = "tt-val";
    val.textContent = fmtNaira(r.v);
    rowEl.append(key, nm, val);
    tt.appendChild(rowEl);
  }
  tt.hidden = false;
  positionPop(tt, ev);
}

function positionPop(el, ev) {
  const card = document.querySelector(".chart-card");
  const rect = card.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  const flip = x > rect.width - 320;
  el.style.left = flip ? (x - el.offsetWidth - 16) + "px" : (x + 16) + "px";
  el.style.top = Math.max(8, y - el.offsetHeight / 2) + "px";
}

function hideTooltip() {
  document.getElementById("tooltip").hidden = true;
  gHover.selectAll("line.crosshair").remove();
}

/* ---------- reading panel (flag 4: descriptions users can relate to) ---------- */
function updateReading() {
  const body = document.getElementById("readingBody");
  const caveat = document.getElementById("readingCaveat");
  if (state.focus) {
    const p = state.personas[state.focus];
    body.textContent = p.story;
    caveat.textContent = "⚠ " + p.caveat +
      " % figures are against this person's own target only — never compare them across people.";
  } else {
    body.textContent = METRICS[state.metric].reading;
    caveat.textContent =
      "⚠ Honesty note: each person's “% of target” is measured against a different " +
      "kind of target, so percentages are never compared between people here — each life is read " +
      "on its own terms. All data is synthetic (real 2025 anchor prices, interpolated daily " +
      "entries) and illustrative, not predictive.";
  }
}

/* ---------- table view (accessibility: everything hover shows, without hovering) ---------- */
function buildTable() {
  const wrap = document.getElementById("tableWrap");
  wrap.replaceChildren();
  const keys = visibleKeys();
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  for (const h of ["Person", "Date", "Age", "Milestone", "Dream asset", "% own target"]) {
    const th = document.createElement("th");
    th.textContent = h;
    hr.appendChild(th);
  }
  thead.appendChild(hr);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  for (const k of keys) {
    const p = state.personas[k];
    for (const ms of p.milestones) {
      const tr = document.createElement("tr");
      const cells = [p.name, ms.date, String(ms.age), ms.item, fmtNaira(ms.ngn), ms.pct.toFixed(1) + "%"];
      cells.forEach((c, i) => {
        const td = document.createElement("td");
        td.textContent = c;
        if (i >= 4) td.className = "num";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
}

/* ---------- state changes ---------- */
function setFocus(key) {
  state.focus = key;
  labelSlots.pos = {};
  updateCards();
  render();
  MLHooks.forEach((fn) => fn());
}

function setMetric(metric) {
  state.metric = metric;
  labelSlots.pos = {};
  labelSlots.order = null;
  document.querySelectorAll(".metric-btn").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.metric === metric));
  render();
}

/* ---------- boot ---------- */
(async function boot() {
  await loadAll();
  buildCards();
  initChart();
  document.getElementById("clearFocus").addEventListener("click", () => setFocus(null));
  document.querySelectorAll(".metric-btn").forEach((b) =>
    b.addEventListener("click", () => setMetric(b.dataset.metric)));
  render();
  // Phase-2 modules (loaded after this file; boot runs post-fetch so they exist)
  if (window.initHeatmap) window.initHeatmap();
  if (window.initArtifacts) window.initArtifacts();
  if (window.initSimulator) window.initSimulator();
  window.state = state;                                  // population module reads this
  if (window.initPopulation) window.initPopulation();    // module loaded first
})();
