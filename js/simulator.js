/* Money Lens — Phase 3: the shock/stabilizer simulator.
   Recomputes each persona's monthly trajectory under active events.

   The model (deliberately simple, fully explainable — every rule is visible in
   the UI copy):
   - An event multiplies monthly categories (income, essential, coping, leak),
     inflates the REAL COST of the dream (dreamCost — same naira buys less
     progress), and/or takes a one-off bite of the balance (ponzi, ajo payout).
   - Dream spending scales with what's left after surviving ("capacity"):
     windfalls speed dreams up, squeezes slow them down.
   - HARD PAUSE: when the balance is deep in debt (below −2× the persona's
     average monthly essentials), dream spending stops entirely that month.
   - "Real terms" progress = shocked dream spend ÷ dreamCost, so a currency
     collapse can make a line rise in naira while falling in what it buys.
   Multipliers are curated judgments (illustration, not forecast). */

"use strict";

(function () {
  /* ================= event config =================
     fields default to 1 (no effect). window in months (Infinity = permanent
     from the hit month). oneOff = fraction of the running balance added at the
     hit month (negative = taken). Per-persona overrides carry the notes shown
     in the "what changed and why" panel. */
  const EVENTS = {
    /* ---------------- shocks ---------------- */
    currency_collapse: {
      kind: "shock", icon: "💱", label: "Currency collapse", window: Infinity,
      base: { essential: 1.25, coping: 1.15 },
      per: {
        kids_abroad: { dreamCost: 2.4, note: "The degree is priced in pounds — the same term now costs 2.4× the naira." },
        dollar_earner: { income: 2.8, note: "Paid in dollars: the crash multiplies his naira income. His shock is everyone else's stabilizer." },
        japa: { dreamCost: 2.2, note: "Proof-of-funds, ticket and fees are foreign-priced — the exit recedes as she saves." },
        landlord: { dreamCost: 1.35, note: "New cement and roofing sheets creep up — but blocks already laid are safely out of the currency." },
        instagrammer: { dreamCost: 1.5, essential: 1.35, note: "The performed lifestyle is import-priced: gadgets, venues, looks." },
        ama: { income: 0.95, note: "Dispatch work thins as everything costs more." },
        coping_control: { essential: 1.35, note: "Everything in the market is imported — the squeeze tightens on a household with no cushion." },
      },
    },
    subsidy_removed: {
      kind: "shock", icon: "⛽", label: "Subsidy removed", window: Infinity,
      base: { essential: 1.3, coping: 1.35 },
      per: {
        ama: { income: 0.85, note: "A dispatch rider buys petrol every day — his margin WAS the subsidy." },
        coping_control: { coping: 1.5, note: "Generator fuel doubles; the coping ledger swallows what little was left." },
        dollar_earner: { coping: 1.25, note: "Diesel for the inverter costs more — but dollars absorb it without breaking stride." },
        landlord: { note: "Transport to site and block deliveries all carry the new fuel price." },
      },
    },
    power_collapse: {
      kind: "shock", icon: "🔌", label: "Grid collapse", window: 18,
      base: { coping: 1.4 },
      per: {
        dollar_earner: { coping: 1.6, note: "Uptime is his job — he pays whatever power costs, and keeps earning." },
        instagrammer: { dreamCost: 1.3, note: "Content needs light, charge and data — every post now costs more to fake." },
        coping_control: { coping: 1.55, note: "More generator hours, same income. The wall of grey gets heavier." },
      },
    },
    cash_crunch: {
      kind: "shock", icon: "🏧", label: "Cash crunch (naira redesign)", window: 5,
      base: { income: 0.75 },
      per: {
        landlord: { income: 0.6, note: "A POS agent lives on cash moving — when notes vanish, his side business starves." },
        instagrammer: { income: 0.65, note: "Bailouts and gifts dry up when everyone is queuing at ATMs." },
        coping_control: { income: 0.7, note: "Kiosk customers have no cash to spend." },
        dollar_earner: { income: 1.0, note: "Paid into a dom account — the ATM queue is not his problem." },
      },
    },
    ponzi_wave: {
      kind: "shock", icon: "🕳️", label: "Ponzi wave", window: 8,
      base: { oneOff: -0.05, leak: 1.2 },
      per: {
        ama: { oneOff: -0.35, leak: 1.8, note: "He is the exact target market — capital wiped, again, chasing the multiplier." },
        japa: { oneOff: -0.12, note: "A 'faster visa' agent surfaces exactly when she is most desperate." },
        dollar_earner: { oneOff: -0.10, note: "A crypto 'yield farm' gets him — once." },
        landlord: { oneOff: -0.03, note: "He hears the pitch at the viewing centre and mostly walks away." },
      },
    },
    platform_crackdown: {
      kind: "shock", icon: "📵", label: "Platform crackdown", window: 12,
      base: {},
      per: {
        instagrammer: { income: 0.45, dreamSpend: 0.8, note: "Reach collapses; bailouts and sponsors vanish with it." },
        dollar_earner: { income: 0.9, note: "One client churns; the skill still travels." },
        ama: { leak: 0.7, note: "Betting apps blocked — the leak is forced shut, and the money stays put for once." },
      },
    },

    /* ---------------- stabilizers ---------------- */
    subsidy_back: {
      kind: "stab", icon: "🛡️", label: "Subsidy", window: Infinity,
      base: { essential: 0.85, coping: 0.75 },
      per: {
        coping_control: { coping: 0.6, note: "Cheaper fuel is a raise for a household whose biggest bill is the generator." },
        ama: { income: 1.08, note: "Cheaper petrol widens a dispatch rider's margin directly." },
      },
    },
    ajo_payout: {
      kind: "stab", icon: "🤝", label: "Ajo / esusu payout", window: 1,
      base: { oneOff: 0.12 },
      per: {
        landlord: { oneOff: 0.2, note: "His turn in the cooperative — a lump lands and becomes blocks within the month." },
        japa: { oneOff: 0.18, note: "The pooling circle pays out toward proof-of-funds." },
        coping_control: { oneOff: 0.08, note: "For once the ajo survives long enough to pay rent advance without borrowing." },
      },
    },
    remittance_wave: {
      kind: "stab", icon: "🌍", label: "Remittance wave", window: 24,
      base: { income: 1.15 },
      per: {
        kids_abroad: { income: 1.35, note: "The diaspora rescue arrives earlier and bigger — the pool deepens." },
        japa: { income: 1.3, note: "Relatives abroad rally behind the exit." },
        dollar_earner: { income: 1.0, note: "He IS the remittance — nothing new arrives." },
      },
    },
    rent_income: {
      kind: "stab", icon: "🏠", label: "Asset income (rent)", window: Infinity,
      base: { income: 1.05 },
      per: {
        landlord: { income: 1.25, note: "The two rooms start paying back — the dream itself becomes the stabilizer." },
        coping_control: { income: 1.0, note: "No asset, no rent. Stabilizers built on assets skip the asset-less." },
      },
    },
    viral_breakthrough: {
      kind: "stab", icon: "🚀", label: "Viral breakthrough", window: Infinity,
      base: {},
      per: {
        instagrammer: { income: 5.0, leak: 0.8, note: "One reel lands. Brand deals become real income — the 1-in-a-million winner path (it DOES exist)." },
        dollar_earner: { income: 1.15, note: "A conference talk brings two new clients." },
        ama: { income: 1.1, note: "His skit account finally pays a little." },
      },
    },
    stable_naira: {
      kind: "stab", icon: "💪", label: "Stable naira", window: Infinity,
      base: { essential: 0.92 },
      per: {
        kids_abroad: { dreamCost: 0.75, note: "The pound stops running away — the same fees, fewer naira." },
        japa: { dreamCost: 0.8, note: "The exit stops receding." },
        dollar_earner: { income: 0.85, note: "A strong naira quietly cuts his converted salary — stability isn't free for everyone." },
      },
    },
  };

  const FIELDS = ["income", "essential", "coping", "leak", "dreamSpend", "dreamCost"];
  window.ML_EVENTS = EVENTS;   // shared with the Phase-4 population engine
  const sim = { active: new Set(), when: 3, metric: "progress" };

  /* ================= engine ================= */
  function multipliersFor(key, monthOffset) {
    const m = { income: 1, essential: 1, coping: 1, leak: 1, dreamSpend: 1, dreamCost: 1 };
    let oneOff = 0;
    for (const id of sim.active) {
      const ev = EVENTS[id];
      const over = ev.per[key] || {};
      if (monthOffset === 0) oneOff += (over.oneOff !== undefined ? over.oneOff : (ev.base.oneOff || 0));
      if (monthOffset < 0 || monthOffset >= ev.window) continue;
      for (const f of FIELDS) {
        const v = over[f] !== undefined ? over[f] : (ev.base[f] !== undefined ? ev.base[f] : 1);
        m[f] *= v;
      }
    }
    return { m, oneOff };
  }

  function runScenario(key) {
    const p = state.personas[key];
    const months = p.monthly;
    const T = sim.when * 12;
    const avgInc = d3.mean(months, (r) => r.income);
    const avgEss = Math.abs(d3.mean(months, (r) => r.essential));
    const avgCop = Math.abs(d3.mean(months, (r) => r.coping));
    const baseSurplus = Math.max(1, avgInc - avgEss - avgCop);

    let bal = months[0].balance - (months[0].income + months[0].essential + months[0].coping +
      months[0].dream + months[0].savings + months[0].diversion + months[0].social);
    let progress = 0;
    let pausedMonths = 0;
    const out = [];

    for (let i = 0; i < months.length; i++) {
      const r = months[i];
      const off = i - T;
      const { m, oneOff } = multipliersFor(key, off);

      const inc = r.income * m.income;
      const ess = r.essential * m.essential;
      const cop = r.coping * m.coping;
      const leak = r.diversion * m.leak;

      // capacity: dream spending scales with what's left after surviving
      const capacity = Math.max(0, Math.min(2.2,
        (avgInc * m.income - avgEss * m.essential - avgCop * m.coping) / baseSurplus));
      let dream = r.dream * m.dreamSpend * capacity;

      // hard pause: drowning households stop feeding the dream
      if (bal < -2 * avgEss && dream < 0) { dream = 0; if (off >= 0) pausedMonths++; }

      if (off === 0 && oneOff !== 0 && bal > 0) bal += bal * oneOff;

      bal += inc + ess + cop + dream + r.savings + leak + r.social;
      progress += Math.abs(dream) / m.dreamCost;

      out.push({ m: r.m, balance: bal, progress });
    }
    return { series: out, pausedMonths };
  }

  function baseline(key) {
    const p = state.personas[key];
    let progress = 0;
    return p.monthly.map((r) => {
      progress += Math.abs(r.dream);
      return { m: r.m, balance: r.balance, progress };
    });
  }

  /* ================= verdicts ================= */
  function verdictFor(key, shocked, base) {
    const p = state.personas[key];
    const bEnd = base.at(-1), sEnd = shocked.series.at(-1);
    const dBal = sEnd.balance - bEnd.balance;

    if (key === "coping_control") {
      const minBal = d3.min(shocked.series, (d) => d.balance);
      const word = dBal < -150000 || minBal < -400000 ? "sinking" :
                   dBal > 150000 ? "breathing easier" : "surviving";
      const cls = word === "sinking" ? "v-dies" : word === "breathing easier" ? "v-thrives" : "v-control";
      return { word: word + " — no dream to lose", cls, delta: `balance ${fmtDelta(dBal)}` };
    }
    const r = sEnd.progress / Math.max(1, bEnd.progress);
    let word, cls;
    if (r >= 1.12) { word = "thrives"; cls = "v-thrives"; }
    else if (r >= 0.88) { word = "holds the line"; cls = "v-holds"; }
    else if (r >= 0.5) { word = "wounded"; cls = "v-wounded"; }
    else { word = "the dream dies"; cls = "v-dies"; }
    let delta = `dream ${r >= 1 ? "+" : ""}${Math.round((r - 1) * 100)}% · balance ${fmtDelta(dBal)}`;
    if (shocked.pausedMonths > 0) delta += ` · paused ${shocked.pausedMonths} mo`;
    return { word, cls, delta };
  }

  function fmtDelta(v) {
    return (v >= 0 ? "+" : "−") + fmtNaira(Math.abs(v)).slice(1);
  }

  /* ================= UI ================= */
  const SW = 980, SH = 470;
  const SM = { top: 20, right: 150, bottom: 40, left: 64 };
  let ssvg, sgGrid, sgLines, sgLabels, sgAxes, sgMarker;

  window.initSimulator = function initSimulator() {
    for (const [id, ev] of Object.entries(EVENTS)) {
      const wrap = document.getElementById(ev.kind === "shock" ? "shockBtns" : "stabBtns");
      const b = document.createElement("button");
      b.className = "sim-btn " + (ev.kind === "shock" ? "shock" : "stab");
      b.dataset.id = id;
      b.textContent = ev.icon + " " + ev.label;
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => {
        if (sim.active.has(id)) sim.active.delete(id); else sim.active.add(id);
        b.classList.toggle("is-on", sim.active.has(id));
        b.setAttribute("aria-pressed", String(sim.active.has(id)));
        renderSim(true);
      });
      wrap.appendChild(b);
    }
    const slider = document.getElementById("whenSlider");
    slider.addEventListener("input", () => {
      sim.when = +slider.value;
      document.getElementById("whenLabel").textContent = slider.value;
      renderSim(true);
    });
    document.getElementById("simReset").addEventListener("click", () => {
      sim.active.clear();
      document.querySelectorAll(".sim-btn").forEach((b) => {
        b.classList.remove("is-on");
        b.setAttribute("aria-pressed", "false");
      });
      renderSim(true);
    });
    document.querySelectorAll("#simMetricToggle .metric-btn").forEach((b) =>
      b.addEventListener("click", () => {
        sim.metric = b.dataset.simMetric;
        document.querySelectorAll("#simMetricToggle .metric-btn").forEach((x) =>
          x.classList.toggle("is-active", x === b));
        renderSim(true);
      }));

    ssvg = d3.select("#simChart").append("svg")
      .attr("viewBox", `0 0 ${SW} ${SH}`)
      .attr("role", "img")
      .attr("aria-label", "Simulated trajectories under chosen shocks and stabilizers");
    sgGrid = ssvg.append("g");
    sgMarker = ssvg.append("g");
    sgLines = ssvg.append("g");
    sgLabels = ssvg.append("g");
    sgAxes = ssvg.append("g");
    renderSim(false);
  };

  function renderSim(animate) {
    const metric = sim.metric;
    const data = PERSONA_ORDER.map((key) => ({
      key,
      p: state.personas[key],
      base: baseline(key),
      shocked: runScenario(key),
    }));

    const maxM = d3.max(data, (d) => d.base.length - 1);
    let vMin = 0, vMax = 1;
    for (const d of data) {
      for (const arr of [d.base, d.shocked.series]) {
        vMin = Math.min(vMin, d3.min(arr, (x) => x[metric]));
        vMax = Math.max(vMax, d3.max(arr, (x) => x[metric]));
      }
    }
    const pad = (vMax - vMin) * 0.05 || 1;
    const x = d3.scaleLinear().domain([0, maxM]).range([SM.left, SW - SM.right]);
    const y = d3.scaleLinear().domain([vMin - pad, vMax + pad]).range([SH - SM.bottom, SM.top]);
    const line = d3.line().x((d) => x(d.m)).y((d) => y(d[metric])).curve(d3.curveMonotoneX);
    const t = ssvg.transition().duration(animate ? 600 : 0).ease(d3.easeCubicOut);

    const ticks = y.ticks(6);
    sgGrid.selectAll("line.gridline").data(ticks, (d) => d)
      .join(
        (en) => en.append("line").attr("class", "gridline")
          .attr("x1", SM.left).attr("x2", SW - SM.right).attr("y1", y).attr("y2", y),
        (up) => up.call((s) => s.transition(t).attr("y1", y).attr("y2", y)),
        (ex) => ex.remove()
      );

    // hit-month marker
    const hitX = x(sim.when * 12);
    sgMarker.selectAll("line").data(sim.active.size ? [1] : [])
      .join("line")
      .attr("stroke", "#e66767").attr("stroke-dasharray", "4 4").attr("stroke-width", 1.2)
      .attr("y1", SM.top).attr("y2", SH - SM.bottom)
      .transition(t).attr("x1", hitX).attr("x2", hitX);
    sgMarker.selectAll("text").data(sim.active.size ? [1] : [])
      .join("text")
      .attr("fill", "#e66767").attr("font-size", 10.5).attr("text-anchor", "middle")
      .text("events hit")
      .transition(t).attr("x", hitX).attr("y", SM.top - 6);

    sgAxes.selectAll("*").remove();
    sgAxes.append("g").attr("class", "axis")
      .attr("transform", `translate(0,${SH - SM.bottom})`)
      .call(d3.axisBottom(x).tickValues(d3.range(0, maxM + 1, 12))
        .tickFormat((d) => (d === 0 ? "Month 0" : `Year ${d / 12}`)).tickSize(4));
    sgAxes.append("g").attr("class", "axis")
      .attr("transform", `translate(${SM.left},0)`)
      .call(d3.axisLeft(y).tickValues(ticks).tickFormat(fmtNaira).tickSize(4));

    // baseline ghosts (dashed) + shocked lines (solid)
    sgLines.selectAll("path.sim-base").data(data, (d) => d.key)
      .join("path")
      .attr("class", "sim-base")
      .attr("fill", "none")
      .attr("stroke", (d) => d.p.color)
      .attr("stroke-width", 1.3)
      .attr("stroke-dasharray", "3 4")
      .attr("opacity", 0.35)
      .transition(t)
      .attr("d", (d) => line(d.base));

    sgLines.selectAll("path.sim-line").data(data, (d) => d.key)
      .join("path")
      .attr("class", "sim-line")
      .attr("fill", "none")
      .attr("stroke", (d) => d.p.color)
      .attr("stroke-width", 2.4)
      .attr("stroke-linejoin", "round")
      .transition(t)
      .attr("d", (d) => line(d.shocked.series));

    // end labels
    sgLabels.selectAll("text").data(data, (d) => d.key)
      .join("text")
      .attr("class", "series-label")
      .attr("fill", (d) => d.p.color)
      .text((d) => d.p.name)
      .transition(t)
      .attr("x", (d) => x(d.shocked.series.at(-1).m) + 8)
      .attr("y", labelDodgeSim(data, metric, y));

    renderVerdicts(data);
    renderNotes();
  }

  function labelDodgeSim(data, metric, y) {
    const pos = {};
    const sorted = [...data].sort((a, b) =>
      y(a.shocked.series.at(-1)[metric]) - y(b.shocked.series.at(-1)[metric]));
    let last = -1e9;
    for (const d of sorted) {
      let yy = y(d.shocked.series.at(-1)[metric]);
      if (yy - last < 13) yy = last + 13;
      pos[d.key] = yy;
      last = yy;
    }
    return (d) => pos[d.key];
  }

  function renderVerdicts(data) {
    const wrap = document.getElementById("verdicts");
    wrap.replaceChildren();
    if (!sim.active.size) return;
    for (const d of data) {
      const v = verdictFor(d.key, d.shocked, d.base);
      const card = document.createElement("div");
      card.className = "verdict-card";
      card.style.setProperty("--vc", d.p.color);
      const name = document.createElement("div");
      name.className = "verdict-name";
      const sw = document.createElement("i");
      name.append(sw, document.createTextNode(d.p.name));
      const word = document.createElement("div");
      word.className = "verdict-word " + v.cls;
      word.textContent = v.word;
      const delta = document.createElement("div");
      delta.className = "verdict-delta";
      delta.textContent = v.delta;
      card.append(name, word, delta);
      wrap.appendChild(card);
    }
  }

  function renderNotes() {
    const wrap = document.getElementById("simNotes");
    wrap.replaceChildren();
    for (const id of sim.active) {
      const ev = EVENTS[id];
      for (const key of PERSONA_ORDER) {
        const over = ev.per[key];
        if (!over || !over.note) continue;
        const row = document.createElement("div");
        row.className = "sim-note";
        const evEl = document.createElement("span");
        evEl.className = "sn-event";
        evEl.textContent = ev.icon + " " + ev.label + " · ";
        const nameEl = document.createElement("b");
        nameEl.textContent = state.personas[key].name + ": ";
        row.append(evEl, nameEl, document.createTextNode(over.note));
        wrap.appendChild(row);
      }
    }
  }
})();
