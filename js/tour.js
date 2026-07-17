/* Money Lens — the guided tour / story mode. Six stops that walk a first-time
   reader through the whole page in order: cast → climb → weeks → simulator →
   city → objects. The tour drives the app's REAL controls (persona cards,
   shock buttons, the city's play button) so it exercises the same code paths
   a human would — ending the tour anywhere leaves a normal, explorable page.
   All copy is static; text still lands via textContent per the house rule. */

"use strict";

(function () {
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- drivers: poke the existing controls, idempotently ---------- */

  // Click a shock/stabilizer chip only if its on/off state differs from `on`.
  // scopeSel distinguishes the 2-D simulator's buttons from the city's chips.
  function setEventChip(scopeSel, id, on) {
    const b = document.querySelector(`${scopeSel} .sim-btn[data-id="${id}"]`);
    if (b && b.classList.contains("is-on") !== on) b.click();
  }

  function setPersonaFocus(key) {
    if (key === null) {
      const clear = document.getElementById("clearFocus");
      if (clear && !clear.hidden) clear.click();
      return;
    }
    const card = document.querySelector(`.persona-card[data-key="${key}"]`);
    if (card && !card.classList.contains("is-focused")) card.click();
  }

  function clickIf(id) {
    const el = document.getElementById(id);
    if (el) el.click();
  }

  /* ---------- the six stops (page order) ---------- */

  const STEPS = [
    {
      target: "#cast",
      title: "Seven lives, one lens",
      body:
        "Seven Lagos households, ~82,000 synthetic transactions over 6–10 years. Five dreams — " +
        "a house, an exit, a degree, a break, a persona — plus one household that never gets to " +
        "dream, and one paid in dollars. Each card is a life; you can click one at any time to " +
        "enter it. Everything here is synthetic and illustrative (real 2025 anchor prices), " +
        "not a prediction.",
      onEnter() {
        setPersonaFocus(null);
        clickIf("simReset");
        clickIf("popReset");
      },
    },
    {
      target: "#sec-climb",
      title: "The line that rockets",
      body:
        "The purple line is the Adeyemi household paying for a UK degree. It doesn't rocket " +
        "because they got richer — the naira collapsed ₦460 → ₦2,050 per pound mid-journey, so " +
        "the SAME degree kept costing more. ₦66m spent, more than the other four dreams " +
        "combined: a shock wearing the costume of growth. Hover the dots to see each milestone land.",
      onEnter() {
        setPersonaFocus("kids_abroad");
      },
    },
    {
      target: "#sec-weeks",
      title: "The grey wall",
      body:
        "Every square is one week of a life: green built the dream, red leaked away, grey just " +
        "survived. The Control (top) is the household that never gets to dream — a near-unbroken " +
        "wall of grey. AMA's block below is the opposite wall: near-solid red, a betting habit " +
        "visible from orbit. Same city, same years, same hands.",
      onEnter() {
        setPersonaFocus(null);
      },
    },
    {
      target: "#sec-sim",
      title: "One shock, two directions",
      body:
        "We just hit all seven lives with a currency collapse (dashed ghosts = the unshocked " +
        "baseline). Kids Abroad's dream dies — the pound-priced degree now costs 2.4× the naira. " +
        "The Dollar Earner THRIVES: paid in dollars, the crash multiplies his income. One shock, " +
        "one family's ruin, another's raise. The verdict cards below call it life by life.",
      onEnter() {
        clickIf("simReset");
        setEventChip("#shockBtns", "currency_collapse", true);
      },
    },
    {
      target: "#sec-city",
      title: "A city of 1,000 dreams",
      body:
        "1,000 procedural households, each in its real neighborhood. Height = naira actually " +
        "built into the dream; green is building, gold has arrived, red is leaking, grey " +
        "survives. We composed one event for this run: a currency collapse landing in July of " +
        "Year 3 — watch the ripple sweep the city and which side of the lagoon keeps growing. " +
        "You can also run it neutral, let a seed surprise you, or drop your own shocks on any " +
        "month." +
        (REDUCED ? " Press ▶ Play to run the seven years." : ""),
      onEnter() {
        if (window.MLCity) {
          window.MLCity.reset();
          window.MLCity.setSchedule([{ id: "currency_collapse", start: 30, dur: 54 }]);
          if (!REDUCED) window.MLCity.play(true);
        }
      },
    },
    {
      target: "#sec-objects",
      title: "What the money became",
      body:
        "Everything a ledger literally bought, tiled by cost — the house arrives in parts, the " +
        "degree in instalments, and the leak sits right among them in red, bought with the same " +
        "hands. That's the tour. Now it's yours: click a life, press a shock, replay the city.",
      onEnter() {},
    },
  ];

  /* ---------- tour UI ---------- */

  const tour = { on: false, step: 0 };
  let card, stepLabel, titleEl, bodyEl, dotsEl, backBtn, nextBtn;

  function buildCard() {
    card = document.createElement("div");
    card.className = "tour-card";
    card.id = "tourCard";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "Guided tour");
    card.setAttribute("tabindex", "-1");   // focusable once at start, not in tab order
    card.hidden = true;

    stepLabel = document.createElement("div");
    stepLabel.className = "tour-step-label";

    titleEl = document.createElement("h4");
    titleEl.className = "tour-title";

    bodyEl = document.createElement("p");
    bodyEl.className = "tour-body";
    bodyEl.setAttribute("aria-live", "polite");

    dotsEl = document.createElement("div");
    dotsEl.className = "tour-dots";
    dotsEl.setAttribute("aria-hidden", "true");
    for (let i = 0; i < STEPS.length; i++) {
      const d = document.createElement("i");
      d.addEventListener("click", () => goTo(i));
      dotsEl.appendChild(d);
    }

    const nav = document.createElement("div");
    nav.className = "tour-nav";

    backBtn = document.createElement("button");
    backBtn.className = "tour-btn";
    backBtn.textContent = "← Back";
    backBtn.addEventListener("click", () => goTo(tour.step - 1));

    nextBtn = document.createElement("button");
    nextBtn.className = "tour-btn tour-next";
    nextBtn.addEventListener("click", () => {
      if (tour.step >= STEPS.length - 1) endTour();
      else goTo(tour.step + 1);
    });

    const endBtn = document.createElement("button");
    endBtn.className = "tour-end";
    endBtn.textContent = "End tour ✕";
    endBtn.setAttribute("aria-label", "End the tour");
    endBtn.addEventListener("click", endTour);

    nav.append(backBtn, nextBtn, endBtn);
    card.append(stepLabel, titleEl, bodyEl, dotsEl, nav);
    document.body.appendChild(card);
  }

  function spotlight(sel) {
    document.querySelectorAll(".tour-spot").forEach((el) => el.classList.remove("tour-spot"));
    const target = sel ? document.querySelector(sel) : null;
    if (target) target.classList.add("tour-spot");
    return target;
  }

  function goTo(i) {
    tour.step = Math.max(0, Math.min(STEPS.length - 1, i));
    const s = STEPS[tour.step];

    const target = spotlight(s.target);
    if (target) {
      target.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" });
    }
    s.onEnter();

    stepLabel.textContent = `Stop ${tour.step + 1} of ${STEPS.length}`;
    titleEl.textContent = s.title;
    bodyEl.textContent = s.body;
    backBtn.disabled = tour.step === 0;
    nextBtn.textContent = tour.step >= STEPS.length - 1 ? "Finish ✓" : "Next →";
    dotsEl.querySelectorAll("i").forEach((d, j) =>
      d.classList.toggle("is-here", j === tour.step));
    // NOTE: deliberately no button.focus() here — spacebar is a scroll key,
    // and a focused Next button would turn every space-scroll into a step-skip.
    // Arrow keys navigate via the document-level handler regardless of focus.
  }

  function startTour() {
    tour.on = true;
    document.body.classList.add("is-touring");
    card.hidden = false;
    card.focus({ preventScroll: true });   // one-time: put screen readers on the dialog
    goTo(0);
  }

  function endTour() {
    // Leaves the app state exactly where the tour left it — the page stays explorable.
    tour.on = false;
    document.body.classList.remove("is-touring");
    card.hidden = true;
    spotlight(null);
  }

  function onKey(ev) {
    if (!tour.on) return;
    const tag = ev.target && ev.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;   // don't fight the sliders
    if (ev.key === "Escape") endTour();
    else if (ev.key === "ArrowRight") { ev.preventDefault(); goTo(tour.step + 1); }
    else if (ev.key === "ArrowLeft") { ev.preventDefault(); goTo(tour.step - 1); }
  }

  /* ---------- boot ----------
     Same race-safe pattern as population.js: app.js's async boot may finish
     BEFORE this file parses (fast local fetches), so we self-init if the app
     is already up, and stay callable from boot() otherwise. Idempotent. */
  function initTour() {
    if (card) return;   // already initialized
    buildCard();
    const start = document.getElementById("tourStart");
    if (start) start.addEventListener("click", startTour);
    document.addEventListener("keydown", onKey);
  }
  window.initTour = initTour;
  if (window.state && Object.keys(window.state.personas || {}).length) initTour();
})();
