/* Money Lens — Phase 2a: interactive life-in-weeks heatmap.
   One row of squares per year, one square per week, all five personas stacked.
   Colour = what the discretionary money did (green built / red leaked / grey quiet),
   same score buckets as the canonical life_heatmap.svg, restated for a dark surface.
   Milestone weeks carry a ring; hovering any cell explains the week. */

"use strict";

(function () {
  const CELL = 15, GAP = 2, WEEKS_PER_ROW = 52;
  const LEFT = 118, TOP_PAD = 8, BLOCK_GAP = 30;

  // Dark-surface restatement of the canonical buckets. Bright = strong signal;
  // green is kept lighter than red so the pair also differs in luminance (CVD help).
  function cellColor(score, dream, leak) {
    if (dream + leak < 1500) return "#33332f";          // quiet / surviving
    if (score <= -0.66) return "#e04b3f";               // leaked hard
    if (score <= -0.2) return "#8a3430";                // leaked
    if (score < 0.2) return "#4a4a44";                  // mixed
    if (score < 0.66) return "#3a7d2c";                 // built
    return "#5ec43a";                                   // built hard
  }

  function verdict(score, dream, leak) {
    if (dream + leak < 1500) return "Quiet week — just surviving";
    if (score <= -0.2) return "The leak won this week";
    if (score < 0.2) return "Built and leaked in equal measure";
    return "The dream won this week";
  }

  let built = false;

  window.initHeatmap = function initHeatmap() {
    const host = d3.select("#heatmap");
    host.selectAll("*").remove();

    // Layout: per persona, rows = ceil(weeks/52).
    const blocks = PERSONA_ORDER.map((key) => {
      const p = state.personas[key];
      const rows = Math.ceil(p.weeks.length / WEEKS_PER_ROW);
      return { key, p, rows, height: rows * (CELL + GAP) };
    });
    const width = LEFT + WEEKS_PER_ROW * (CELL + GAP) + 16;
    const height = TOP_PAD +
      blocks.reduce((a, b) => a + b.height + BLOCK_GAP, 0);

    const svg = host.append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", "Life in weeks heatmap for all five personas");

    let y = TOP_PAD;
    for (const b of blocks) {
      const g = svg.append("g").attr("transform", `translate(0,${y})`);

      // persona label (click = focus that persona in the top chart)
      g.append("text")
        .attr("class", "heat-persona-label")
        .attr("x", 0).attr("y", 12)
        .attr("fill", b.p.color)
        .text(b.p.name)
        .on("click", () => { setFocus(state.focus === b.key ? null : b.key); });
      g.append("text")
        .attr("class", "heat-persona-sub")
        .attr("x", 0).attr("y", 27)
        .text(`${Math.round(b.p.weeks.length / 52)} years`);

      // year labels down the left of the grid
      for (let r = 0; r < b.rows; r++) {
        g.append("text")
          .attr("class", "heat-year-label")
          .attr("x", LEFT - 8).attr("y", r * (CELL + GAP) + CELL - 3)
          .attr("text-anchor", "end")
          .text("Y" + (r + 1));
      }

      const cells = g.append("g");
      cells.selectAll("rect")
        .data(b.p.weeks)
        .join("rect")
        .attr("class", "heat-cell")
        .attr("x", (d) => LEFT + (d.w % WEEKS_PER_ROW) * (CELL + GAP))
        .attr("y", (d) => Math.floor(d.w / WEEKS_PER_ROW) * (CELL + GAP))
        .attr("width", CELL).attr("height", CELL)
        .attr("rx", 3)
        .attr("fill", (d) => cellColor(d.score, d.dream, d.leak))
        .on("pointermove", (ev, d) => showWeekTip(ev, b.p, d))
        .on("pointerleave", hideFloatTip);

      // milestone rings on top (non-interactive; the cell below carries the hover)
      cells.selectAll("circle")
        .data(b.p.weeks.filter((d) => d.ms))
        .join("circle")
        .attr("cx", (d) => LEFT + (d.w % WEEKS_PER_ROW) * (CELL + GAP) + CELL / 2)
        .attr("cy", (d) => Math.floor(d.w / WEEKS_PER_ROW) * (CELL + GAP) + CELL / 2)
        .attr("r", CELL / 2 + 1.5)
        .attr("fill", "none")
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1.8)
        .attr("pointer-events", "none");

      y += b.height + BLOCK_GAP;
    }
    built = true;
  };

  function showWeekTip(ev, p, d) {
    const tip = document.getElementById("floatTip");
    tip.replaceChildren();

    const head = document.createElement("div");
    head.className = "ft-head";
    head.textContent = verdict(d.score, d.dream, d.leak);

    const meta = document.createElement("div");
    meta.className = "ft-meta";
    meta.textContent = `${p.name} · week of ${d.date}`;
    tip.append(head, meta);

    if (d.dream > 0) {
      const r = document.createElement("div");
      r.className = "ft-row ft-dream";
      r.textContent = "Dream: " + (d.td ? d.td : "spending");
      const bb = document.createElement("b");
      bb.textContent = fmtNaira(d.dream);
      r.appendChild(bb);
      tip.appendChild(r);
    }
    if (d.leak > 0) {
      const r = document.createElement("div");
      r.className = "ft-row ft-leak";
      r.textContent = "Leak: " + (d.tl ? d.tl : "diversion");
      const bb = document.createElement("b");
      bb.textContent = fmtNaira(d.leak);
      r.appendChild(bb);
      tip.appendChild(r);
    }
    if (d.dream === 0 && d.leak === 0) {
      const r = document.createElement("div");
      r.className = "ft-row";
      r.textContent = "No dream spending, no leak — every naira went to living.";
      tip.appendChild(r);
    }
    if (d.ms) {
      const msEl = document.createElement("div");
      msEl.className = "ft-ms";
      msEl.textContent = "★ Milestone: " + d.ms;
      tip.appendChild(msEl);
    }

    tip.hidden = false;
    positionFloatTip(tip, ev);
  }

  window.positionFloatTip = function positionFloatTip(tip, ev) {
    const pad = 14;
    let x = ev.clientX + pad, yy = ev.clientY + pad;
    if (x + tip.offsetWidth > window.innerWidth - 8) x = ev.clientX - tip.offsetWidth - pad;
    if (yy + tip.offsetHeight > window.innerHeight - 8) yy = ev.clientY - tip.offsetHeight - pad;
    tip.style.left = x + "px";
    tip.style.top = yy + "px";
  };

  window.hideFloatTip = function hideFloatTip() {
    document.getElementById("floatTip").hidden = true;
  };
})();
