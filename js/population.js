/* Money Lens — Phase 4: the population. 1,000 procedural households sampled
   around the seven archetypes, run through the same shock engine (ML_EVENTS
   from simulator.js), rendered as a three.js block-city:
   height = dream built (real terms), colour = what this month is doing.
   Deterministic (seeded RNG) so the same city grows every reload. */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const MONTHS = 84;                       // 7 years — the common span
const MIX = {                            // Lagos-flavoured mix, sums to 1000
  coping_control: 350, ama: 250, landlord: 120, japa: 120,
  kids_abroad: 60, instagrammer: 80, dollar_earner: 20,
};
const ORDER = ["coping_control", "landlord", "japa", "ama",
               "kids_abroad", "instagrammer", "dollar_earner"];

/* status codes → colours */
const ST = { COPING: 0, BUILDING: 1, LEAKING: 2, DEAD: 3, SURGING: 4, DROWNING: 5, DONE: 6 };
const ST_COLOR = {
  [ST.COPING]: new THREE.Color("#5a5850"),
  [ST.BUILDING]: new THREE.Color("#3f9a2f"),
  [ST.LEAKING]: new THREE.Color("#c2372f"),
  [ST.DEAD]: new THREE.Color("#26130f"),
  [ST.SURGING]: new THREE.Color("#7ee04e"),
  [ST.DROWNING]: new THREE.Color("#7e1f1a"),
  [ST.DONE]: new THREE.Color("#e0b83e"),
};
const ST_WORD = {
  [ST.COPING]: "just surviving", [ST.BUILDING]: "building the dream",
  [ST.LEAKING]: "leaking", [ST.DEAD]: "the dream is dead",
  [ST.SURGING]: "building hard", [ST.DROWNING]: "drowning (no dream to lose)",
  [ST.DONE]: "dream completed",
};

/* Only these archetypes can genuinely ARRIVE by spending (house built, exit made,
   degree done, apartment bought). AMA's target is a balance he never reaches and
   Zizi's dream is a projection — finishing their historical spend is not arrival. */
const CAN_COMPLETE = new Set(["landlord", "japa", "kids_abroad", "dollar_earner"]);
const CITY_UNIT = 13.3e6;   // ≈ the Landlord's full house — 1.0 on the height scale

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pop = {
  agents: [], month: 0, playing: false, active: new Set(), when: 3,
  timer: null, three: null,
};

/* ---------------- agents ---------------- */
function buildAgents() {
  const rng = mulberry32(20260716);
  pop.agents = [];
  let id = 0;
  for (const key of ORDER) {
    const src = state.personas[key].monthly;
    const n = Math.min(MONTHS, src.length);
    for (let a = 0; a < MIX[key]; a++) {
      pop.agents.push({
        id: id++, key, n,
        jInc: 0.7 + 0.7 * rng(),      // earnings vary 0.7–1.4×
        jEss: 0.8 + 0.45 * rng(),     // cost of living 0.8–1.25×
        jDream: 0.75 + 0.6 * rng(),   // ambition 0.75–1.35×
        jLeak: 0.4 + 1.5 * rng(),     // discipline 0.4–1.9×
        status: new Uint8Array(MONTHS),
        height: new Float32Array(MONTHS),
        built: new Float32Array(MONTHS),
        completedAt: -1,
      });
    }
  }
}

function eventMults(key, offset) {
  const m = { income: 1, essential: 1, coping: 1, leak: 1, dreamSpend: 1, dreamCost: 1 };
  let oneOff = 0;
  for (const id of pop.active) {
    const ev = window.ML_EVENTS[id];
    const over = ev.per[key] || {};
    if (offset === 0) oneOff += (over.oneOff !== undefined ? over.oneOff : (ev.base.oneOff || 0));
    if (offset < 0 || offset >= ev.window) continue;
    for (const f of Object.keys(m)) {
      const v = over[f] !== undefined ? over[f] : (ev.base[f] !== undefined ? ev.base[f] : 1);
      m[f] *= v;
    }
  }
  return { m, oneOff };
}

function simulateAgent(ag) {
  const src = state.personas[ag.key].monthly;
  const T = pop.when * 12;
  const avgInc = d3.mean(src, (r) => r.income) * ag.jInc;
  const avgEss = Math.abs(d3.mean(src, (r) => r.essential)) * ag.jEss;
  const avgCop = Math.abs(d3.mean(src, (r) => r.coping)) * ag.jEss;
  const baseSurplus = Math.max(1, avgInc - avgEss - avgCop);
  const avgDream = Math.abs(d3.mean(src, (r) => r.dream)) * ag.jDream;

  // expected total = what this agent would build unshocked (their own target)
  let expected = 0;
  for (let i = 0; i < ag.n; i++) expected += Math.abs(src[i].dream) * ag.jDream;
  expected = Math.max(1, expected);

  let bal = 0, progress = 0, pausedRun = 0;
  let dead = false;
  ag.completedAt = -1;

  for (let i = 0; i < MONTHS; i++) {
    const r = src[Math.min(i, ag.n - 1)];
    const frozen = i >= ag.n;             // shorter journeys hold their last state
    const off = i - T;
    const { m, oneOff } = eventMults(ag.key, off);

    if (!frozen) {
      const inc = r.income * ag.jInc * m.income;
      const ess = r.essential * ag.jEss * m.essential;
      const cop = r.coping * ag.jEss * m.coping;
      const leak = r.diversion * ag.jLeak * m.leak;
      const capacity = Math.max(0, Math.min(2.2,
        (avgInc * m.income - avgEss * m.essential - avgCop * m.coping) / baseSurplus));
      let dream = dead ? 0 : r.dream * ag.jDream * m.dreamSpend * capacity;

      if (bal < -2 * avgEss && dream < 0) {
        dream = 0;
        if (off >= 0) pausedRun++;
      } else if (dream < 0) pausedRun = 0;
      if (pausedRun >= 15) dead = true;   // paused over a year: it never restarts

      if (off === 0 && oneOff !== 0 && bal > 0) bal += bal * oneOff;
      bal += inc + ess + cop + dream + r.savings + leak + r.social;
      progress += Math.abs(dream) / m.dreamCost;

      // status of the month
      if (ag.key === "coping_control") {
        ag.status[i] = bal < -3 * avgEss ? ST.DROWNING : ST.COPING;
      } else if (CAN_COMPLETE.has(ag.key) && progress / expected >= 1) {
        ag.status[i] = ST.DONE;          // arrived — stays gold from here on
      } else if (dead) {
        ag.status[i] = ST.DEAD;
      } else if (Math.abs(dream) > 0.35 * Math.max(1, avgDream)) {
        ag.status[i] = capacity > 1.25 ? ST.SURGING : ST.BUILDING;
      } else if (Math.abs(leak) > Math.abs(dream) && Math.abs(leak) > 0.05 * avgInc) {
        ag.status[i] = ST.LEAKING;
      } else {
        ag.status[i] = ST.COPING;
      }
    } else {
      ag.status[i] = ag.status[i - 1] === ST.SURGING ? ST.BUILDING : ag.status[i - 1];
    }

    if (CAN_COMPLETE.has(ag.key) && progress / expected >= 1 && ag.completedAt < 0) {
      ag.completedAt = i;
    }
    ag.built[i] = progress;
    // height = ABSOLUTE naira built on a city-wide sqrt scale (money is money):
    // a ₦700k hustle stays low; the ₦66m degree towers. 1.0 ≈ the Landlord's house.
    ag.height[i] = Math.sqrt(Math.min(progress / CITY_UNIT, 1.7));
  }
}

function simulateAll() {
  for (const ag of pop.agents) simulateAgent(ag);
}

/* ---------------- layout: seven districts ---------------- */
function layoutAgents() {
  // districts side by side (Control largest, far left), gap between blocks
  const GAP = 4, CELL = 1.55;
  let xCursor = 0;
  const plates = [];
  for (const key of ORDER) {
    const n = MIX[key];
    const cols = Math.ceil(Math.sqrt(n * 1.6));   // wider than deep
    const rows = Math.ceil(n / cols);
    const agents = pop.agents.filter((a) => a.key === key);
    agents.forEach((ag, i) => {
      ag.x = xCursor + (i % cols) * CELL;
      ag.z = (i / cols | 0) * CELL - (rows * CELL) / 2;
    });
    plates.push({
      key, x: xCursor - CELL / 2, w: cols * CELL,
      z: -(rows * CELL) / 2 - CELL / 2, d: rows * CELL,
    });
    xCursor += cols * CELL + GAP;
  }
  const totalW = xCursor - GAP;
  for (const ag of pop.agents) ag.x -= totalW / 2;
  for (const pl of plates) pl.x -= totalW / 2;
  return { plates, totalW };
}

/* ---------------- three.js ---------------- */
const H_SCALE = 11;   // world units at 100% of own dream

function initThree(plates, totalW) {
  const wrap = document.getElementById("popCanvas");
  const W = wrap.clientWidth, H = wrap.clientHeight;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b0b0a, totalW * 1.2, totalW * 3);

  const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, totalW * 5);
  camera.position.set(0, totalW * 0.40, totalW * 0.72);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(W, H);
  wrap.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 4, 0);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 20;
  controls.maxDistance = totalW * 1.5;

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.15);
  sun.position.set(40, 80, 30);
  scene.add(sun);

  // district floor plates, tinted with each persona's colour
  for (const pl of plates) {
    const geo = new THREE.PlaneGeometry(pl.w, pl.d);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(state.personas[pl.key].color),
      transparent: true, opacity: 0.10, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pl.x + pl.w / 2, -0.02, pl.z + pl.d / 2);
    scene.add(mesh);
  }

  // the 1,000 blocks
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);   // grow upward from the ground
  const mat = new THREE.MeshLambertMaterial();
  const mesh = new THREE.InstancedMesh(geo, mat, pop.agents.length);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(pop.agents.length * 3), 3);
  scene.add(mesh);

  pop.three = { scene, camera, renderer, controls, mesh, wrap };

  // hover tooltip via raycasting
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  wrap.addEventListener("pointermove", (ev) => {
    const r = wrap.getBoundingClientRect();
    ptr.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObject(mesh)[0];
    const tip = document.getElementById("popTip");
    if (hit && hit.instanceId !== undefined) {
      const ag = pop.agents[hit.instanceId];
      const t = pop.month;
      tip.replaceChildren();
      const b = document.createElement("b");
      b.textContent = state.personas[ag.key].name + " · household #" + (ag.id + 1);
      const line = document.createElement("div");
      line.textContent = `${fmtNaira(ag.built[t])} of dream built · ${ST_WORD[ag.status[t]]}`;
      tip.append(b, line);
      tip.hidden = false;
      tip.style.left = Math.min(ev.clientX - r.left + 14, r.width - 250) + "px";
      tip.style.top = (ev.clientY - r.top - 10) + "px";
    } else tip.hidden = true;
  });
  wrap.addEventListener("pointerleave", () => {
    document.getElementById("popTip").hidden = true;
  });

  window.addEventListener("resize", () => {
    const w2 = wrap.clientWidth, h2 = wrap.clientHeight;
    camera.aspect = w2 / h2;
    camera.updateProjectionMatrix();
    renderer.setSize(w2, h2);
  });

  (function loop() {
    requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  })();
}

const _m4 = new THREE.Matrix4();
function paintMonth(t) {
  const { mesh } = pop.three;
  for (let i = 0; i < pop.agents.length; i++) {
    const ag = pop.agents[i];
    const h = Math.max(0.28, ag.height[t] * H_SCALE);
    _m4.makeScale(1, h, 1);
    _m4.setPosition(ag.x, 0, ag.z);
    mesh.setMatrixAt(i, _m4);
    mesh.setColorAt(i, ST_COLOR[ag.status[t]]);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  updateReadout(t);
}

/* ---------------- readout ---------------- */
function updateReadout(t) {
  const counts = { building: 0, coping: 0, leaking: 0, dead: 0, drowning: 0, completed: 0 };
  for (const ag of pop.agents) {
    const s = ag.status[t];
    if (s === ST.BUILDING || s === ST.SURGING) counts.building++;
    else if (s === ST.LEAKING) counts.leaking++;
    else if (s === ST.DEAD) counts.dead++;
    else if (s === ST.DROWNING) counts.drowning++;
    else if (s !== ST.DONE) counts.coping++;   // DONE is shown via "completed"
    if (ag.completedAt >= 0 && ag.completedAt <= t) counts.completed++;
  }
  const wrap = document.getElementById("popCounts");
  wrap.replaceChildren();
  const stats = [
    ["Dreams completed", counts.completed, "#7ee04e"],
    ["Building this month", counts.building, "#3f9a2f"],
    ["Just surviving", counts.coping, "#98958a"],
    ["Leaking", counts.leaking, "#e66767"],
    ["Dreams dead", counts.dead, "#8a4b3d"],
    ["Drowning (no dream)", counts.drowning, "#c2372f"],
  ];
  for (const [label, n, color] of stats) {
    const el = document.createElement("div");
    el.className = "pop-stat";
    el.style.setProperty("--sc", color);
    const b = document.createElement("b");
    b.textContent = String(n);
    el.append(b, document.createTextNode(label));
    wrap.appendChild(el);
  }
  document.getElementById("popMonth").textContent =
    `Month ${t} · Year ${Math.floor(t / 12) + 1} of 7`;
  document.getElementById("popScrub").value = t;
}

/* ---------------- controls ---------------- */
function setMonth(t) {
  pop.month = Math.max(0, Math.min(MONTHS - 1, t));
  paintMonth(pop.month);
}

function play(on) {
  pop.playing = on;
  document.getElementById("popPlay").textContent = on ? "❚❚ Pause" : "▶ Play";
  clearInterval(pop.timer);
  if (on) {
    pop.timer = setInterval(() => {
      if (pop.month >= MONTHS - 1) { play(false); return; }
      setMonth(pop.month + 1);
    }, 100);
  }
}

function buildEventChips() {
  for (const [id, ev] of Object.entries(window.ML_EVENTS)) {
    const wrap = document.getElementById(ev.kind === "shock" ? "popShockBtns" : "popStabBtns");
    const b = document.createElement("button");
    b.className = "sim-btn " + (ev.kind === "shock" ? "shock" : "stab");
    b.textContent = ev.icon + " " + ev.label;
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => {
      if (pop.active.has(id)) pop.active.delete(id); else pop.active.add(id);
      b.classList.toggle("is-on", pop.active.has(id));
      b.setAttribute("aria-pressed", String(pop.active.has(id)));
      simulateAll();
      paintMonth(pop.month);
    });
    wrap.appendChild(b);
  }
  const slider = document.getElementById("popWhenSlider");
  slider.addEventListener("input", () => {
    pop.when = +slider.value;
    document.getElementById("popWhenLabel").textContent = slider.value;
    simulateAll();
    paintMonth(pop.month);
  });
  document.getElementById("popReset").addEventListener("click", () => {
    pop.active.clear();
    document.querySelectorAll("#popShockBtns .sim-btn, #popStabBtns .sim-btn")
      .forEach((b) => { b.classList.remove("is-on"); b.setAttribute("aria-pressed", "false"); });
    simulateAll();
    setMonth(0);
  });
  document.getElementById("popPlay").addEventListener("click", () => play(!pop.playing));
  document.getElementById("popScrub").addEventListener("input", (ev) => {
    play(false);
    setMonth(+ev.target.value);
  });
}

function buildLegend() {
  const wrap = document.getElementById("popLegend");
  for (const key of ORDER) {
    const p = state.personas[key];
    const el = document.createElement("span");
    const i = document.createElement("i");
    i.style.background = p.color;
    el.append(i, document.createTextNode(`${p.name} ×${MIX[key]}`));
    wrap.appendChild(el);
  }
}

/* ---------------- boot ---------------- */
function boot() {
  try {
    buildAgents();
    simulateAll();
    const { plates, totalW } = layoutAgents();
    initThree(plates, totalW);
    buildEventChips();
    buildLegend();
    setMonth(0);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) play(true);
  } catch (err) {
    const wrap = document.getElementById("popCanvas");
    wrap.textContent = "3D view unavailable here (" + err.message + ") — the seven-life simulator above carries the same engine.";
    wrap.style.cssText += "display:flex;align-items:center;justify-content:center;color:#898781;font-size:13px;padding:20px;";
  }
}

// app.js data may load before or after this module executes
if (window.state && Object.keys(window.state.personas || {}).length) boot();
else window.initPopulation = boot;
