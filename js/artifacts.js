/* Money Lens — Phase 2b: interactive Menzel artifact boards, all five personas.
   Everything the ledger literally bought, tiled by cost (tile AREA = naira, via
   d3.treemap). Green tiles built the dream; red tiles are the leak sitting among
   them. Hover a tile for the receipts. Tabs switch persona; the global focus
   (persona cards / heatmap labels) drives the board too. */

"use strict";

(function () {
  const W = 960, H = 460;
  const DREAM_FILL = "#2f6a24";
  const LEAK_FILL = "#a63028";
  const COPING_FILL = "#55534a";   // grey grammar: what survival bought (the Control)
  const FILLS = { dream: DREAM_FILL, leak: LEAK_FILL, coping: COPING_FILL };
  let current = "landlord";

  window.initArtifacts = function initArtifacts() {
    buildTabs();
    renderBoard(current, false);
    // follow global persona focus
    MLHooks.push(() => {
      if (state.focus && state.focus !== current) {
        current = state.focus;
        updateTabs();
        renderBoard(current, true);
      }
    });
  };

  function buildTabs() {
    const wrap = document.getElementById("artifactTabs");
    wrap.replaceChildren();
    for (const key of PERSONA_ORDER) {
      const p = state.personas[key];
      const b = document.createElement("button");
      b.className = "artifact-tab";
      b.dataset.key = key;
      b.setAttribute("role", "tab");
      b.style.setProperty("--pc", p.color);
      const dot = document.createElement("i");
      b.appendChild(dot);
      b.appendChild(document.createTextNode(p.name));
      b.addEventListener("click", () => {
        current = key;
        updateTabs();
        renderBoard(key, true);
      });
      wrap.appendChild(b);
    }
    updateTabs();
  }

  function updateTabs() {
    document.querySelectorAll(".artifact-tab").forEach((b) => {
      const on = b.dataset.key === current;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
  }

  function renderBoard(key, animate) {
    const p = state.personas[key];
    const host = d3.select("#artifacts");
    let svg = host.select("svg");
    if (svg.empty()) {
      svg = host.append("svg")
        .attr("viewBox", `0 0 ${W} ${H}`)
        .attr("role", "img");
    }
    svg.attr("aria-label", `Artifact board: what ${p.name}'s money became`);

    const root = d3.hierarchy({ children: p.artifacts })
      .sum((d) => d.total || 0)
      .sort((a, b) => b.value - a.value);
    d3.treemap().size([W, H]).paddingInner(4).paddingOuter(2).round(true)(root);

    const total = d3.sum(p.artifacts, (d) => d.total);

    const tiles = svg.selectAll("g.tile").data(root.leaves(), (d) => key + d.data.label);

    const gEnter = tiles.enter().append("g").attr("class", "tile")
      .attr("transform", (d) => `translate(${d.x0},${d.y0})`)
      .style("opacity", 0);
    gEnter.append("rect");
    gEnter.append("text").attr("class", "tile-icon");
    gEnter.append("text").attr("class", "tile-name");
    gEnter.append("text").attr("class", "tile-amt");
    gEnter.append("text").attr("class", "tile-count");

    tiles.exit().transition().duration(220).style("opacity", 0).remove();

    const all = gEnter.merge(tiles);
    const t = animate ? all.transition().duration(560).ease(d3.easeCubicOut) : all;

    t.attr("transform", (d) => `translate(${d.x0},${d.y0})`).style("opacity", 1);
    (animate
      ? all.select("rect").transition().duration(560).ease(d3.easeCubicOut)
      : all.select("rect"))
      .attr("width", (d) => Math.max(0, d.x1 - d.x0))
      .attr("height", (d) => Math.max(0, d.y1 - d.y0))
      .attr("fill", (d) => FILLS[d.data.kind] || DREAM_FILL);

    // labels sized to the tile; anything that can't fit lives in the tooltip
    all.each(function (d) {
      const g = d3.select(this);
      const w = d.x1 - d.x0, h = d.y1 - d.y0;
      const showIcon = w >= 54 && h >= 56;
      const showName = w >= 78 && h >= 42;
      const showAmt = w >= 78 && h >= 60;
      const showCount = w >= 110 && h >= 78 && d.data.count > 1;
      const nameSize = Math.max(11, Math.min(16, w / 11));

      g.select(".tile-icon")
        .attr("x", 10).attr("y", 28)
        .style("display", showIcon ? null : "none")
        .text(d.data.icon);
      g.select(".tile-name")
        .attr("x", 10).attr("y", showIcon ? 50 : 20)
        .attr("font-size", nameSize)
        .style("display", showName ? null : "none")
        .text(d.data.label);
      g.select(".tile-amt")
        .attr("x", 10).attr("y", (showIcon ? 50 : 20) + nameSize + 4)
        .attr("font-size", Math.max(10, nameSize - 3))
        .style("display", showAmt ? null : "none")
        .text(fmtNaira(d.data.total));
      g.select(".tile-count")
        .attr("x", 10).attr("y", (showIcon ? 50 : 20) + nameSize * 2 + 6)
        .attr("font-size", 10.5)
        .style("display", showCount ? null : "none")
        .text(d.data.count.toLocaleString("en") + "×");
    });

    all.on("pointermove", (ev, d) => showTileTip(ev, p, d.data, total))
       .on("pointerleave", hideFloatTip);

    // caption under the reading panel
    const dreamTotal = d3.sum(p.artifacts.filter((a) => a.kind === "dream"), (a) => a.total);
    const leakTotal = d3.sum(p.artifacts.filter((a) => a.kind === "leak"), (a) => a.total);
    const copingTotal = d3.sum(p.artifacts.filter((a) => a.kind === "coping"), (a) => a.total);
    const reading = document.getElementById("artifactReading");
    reading.textContent = copingTotal > 0
      ? `${p.name}: there is no dream on this board — ${fmtNaira(copingTotal)} went to staying ` +
        `alive (grey: generator, water, security, clinic) and ${fmtNaira(leakTotal)} to small ` +
        `hopes (red). This is what a life looks like when coping eats the surplus.`
      : `${p.name}: ${fmtNaira(dreamTotal)} became the dream (green); ${fmtNaira(leakTotal)} ` +
        `leaked away (red) — bought with the same hands, in the same years. ` +
        `Tile area = naira spent over the whole journey.`;
  }

  function showTileTip(ev, p, a, total) {
    const tip = document.getElementById("floatTip");
    tip.replaceChildren();

    const head = document.createElement("div");
    head.className = "ft-head";
    head.textContent = a.icon + " " + a.label;

    const meta = document.createElement("div");
    meta.className = "ft-meta";
    meta.textContent = `${p.name} · ${a.first} → ${a.last}`;
    tip.append(head, meta);

    const rows = [
      ["Total spent", fmtNaira(a.total)],
      ["Purchases", a.count.toLocaleString("en")],
      ["Share of this board", ((a.total / total) * 100).toFixed(1) + "%"],
    ];
    for (const [k, v] of rows) {
      const r = document.createElement("div");
      r.className = "ft-row " + (a.kind === "leak" ? "ft-leak" : "ft-dream");
      r.textContent = k;
      const bb = document.createElement("b");
      bb.textContent = v;
      r.appendChild(bb);
      tip.appendChild(r);
    }
    const verdictEl = document.createElement("div");
    verdictEl.className = "ft-ms";
    verdictEl.textContent =
      a.kind === "leak" ? "▼ This never became the dream."
      : a.kind === "coping" ? "◼ This kept the household alive — coping, not dreaming."
      : "▲ This physically became the dream.";
    tip.appendChild(verdictEl);

    tip.hidden = false;
    positionFloatTip(tip, ev);
  }
})();
