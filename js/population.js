/* Money Lens — Phase 4b: the Lagos timelapse. 1,000 procedural households on a
   stylized Lagos map (real neighborhoods, approximate geography), growing over
   ~50 seconds through 7 years, driven by the shared shock engine (ML_EVENTS).
   Height = ABSOLUTE naira built (Landlord's house ≈ 1.0 on the city scale);
   colour = what this month is doing. Deterministic seeded RNG. */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const MONTHS = 84;
const MONTH_MS = 600;            // 84 months ≈ 50s at 1×
const MIX = {
  coping_control: 350, ama: 250, landlord: 120, japa: 120,
  kids_abroad: 60, instagrammer: 80, dollar_earner: 20,
};
const ORDER = ["coping_control", "landlord", "japa", "ama",
               "kids_abroad", "instagrammer", "dollar_earner"];

/* Real neighborhoods from the persona specs. Anchors are filled at boot from
   data/lagos_map.json (true OSM coordinates projected to map units). */
const DISTRICTS = {
  coping_control: { anchor: [0, 0], r: 8.5, label: "Mushin" },
  ama:            { anchor: [0, 0], r: 7.5, label: "Agege" },
  landlord:       { anchor: [0, 0], r: 5.5, label: "Ikorodu" },
  japa:           { anchor: [0, 0], r: 4.6, label: "Yaba" },
  kids_abroad:    { anchor: [0, 0], r: 3.2, label: "Gbagada" },
  dollar_earner:  { anchor: [0, 0], r: 2.4, label: "Surulere" },
  instagrammer:   { anchor: [0, 0], r: 9.0, rz: 2.4, label: "Lekki" },
};

const CAN_COMPLETE = new Set(["landlord", "japa", "kids_abroad", "dollar_earner"]);
const CITY_UNIT = 13.3e6;
const MAP_W = 150;

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
const WHITE = new THREE.Color("#ffffff");
const RIPPLE_RED = new THREE.Color("#ff5040");
const RIPPLE_GREEN = new THREE.Color("#4dff70");

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pop = {
  agents: [], tf: 0, lastMonth: -1, playing: false, speed: 1,
  active: new Set(), when: 3, three: null,
  slowUntil: 0, ripple: null, bannerShownFor: -1, lastYear: 0,
};

/* ================= agents & engine (unchanged model) ================= */
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
        jInc: 0.7 + 0.7 * rng(),
        jEss: 0.8 + 0.45 * rng(),
        jDream: 0.75 + 0.6 * rng(),
        jLeak: 0.4 + 1.5 * rng(),
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

  let expected = 0;
  for (let i = 0; i < ag.n; i++) expected += Math.abs(src[i].dream) * ag.jDream;
  expected = Math.max(1, expected);

  let bal = 0, progress = 0, pausedRun = 0, dead = false;
  ag.completedAt = -1;

  for (let i = 0; i < MONTHS; i++) {
    const r = src[Math.min(i, ag.n - 1)];
    const frozen = i >= ag.n;
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
      if (pausedRun >= 15) dead = true;

      if (off === 0 && oneOff !== 0 && bal > 0) bal += bal * oneOff;
      bal += inc + ess + cop + dream + r.savings + leak + r.social;
      progress += Math.abs(dream) / m.dreamCost;

      if (ag.key === "coping_control") {
        ag.status[i] = bal < -3 * avgEss ? ST.DROWNING : ST.COPING;
      } else if (CAN_COMPLETE.has(ag.key) && progress / expected >= 1) {
        ag.status[i] = ST.DONE;
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
    ag.height[i] = Math.sqrt(Math.min(progress / CITY_UNIT, 1.7));
  }
}

function simulateAll() { for (const ag of pop.agents) simulateAgent(ag); }

/* ================= layout: neighborhoods on the map ================= */
function layoutAgents() {
  // sunflower-spiral scatter: organic blobs, deterministic
  const GA = Math.PI * (3 - Math.sqrt(5));
  for (const key of ORDER) {
    const d = DISTRICTS[key];
    const agents = pop.agents.filter((a) => a.key === key);
    const n = agents.length;
    const rz = d.rz ? d.rz / d.r : 1;   // Lekki squashes onto the peninsula strip
    agents.forEach((ag, i) => {
      const rr = d.r * Math.sqrt((i + 0.5) / n);
      const th = i * GA;
      ag.x = d.anchor[0] + rr * Math.cos(th);
      ag.z = d.anchor[1] + rr * Math.sin(th) * rz;
    });
  }
}

/* ================= the real-Lagos stage (OSM layers) ================= */
function shapeFrom(points) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  return s;
}

function polysMesh(polys, color, y) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
  for (const ring of polys) {
    if (!ring || ring.length < 3) continue;
    const geo = new THREE.ShapeGeometry(shapeFrom(ring));
    geo.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    group.add(m);
  }
  return group;
}

function linesMesh(polylines, color, opacity, y) {
  // merge every polyline into ONE LineSegments draw call
  const pos = [];
  for (const line of polylines) {
    for (let i = 0; i < line.length - 1; i++) {
      pos.push(line[i][0], y, line[i][1], line[i + 1][0], y, line[i + 1][1]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.LineSegments(geo,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

const layers = {};   // name -> THREE.Group / Object3D (for the toggle chips)

function buildStage(scene, map) {
  const [[x0, z0], [x1, z1]] = map.bbox_units;
  const wBox = x1 - x0, dBox = z1 - z0;

  // land base = the bbox card; real water is painted on top of it
  const land = new THREE.Mesh(
    new THREE.PlaneGeometry(wBox, dBox),
    new THREE.MeshBasicMaterial({ color: 0x1a1b17 }));
  land.rotation.x = -Math.PI / 2;
  land.position.set((x0 + x1) / 2, -0.08, (z0 + z1) / 2);
  scene.add(land);

  // real ocean + lagoon + creeks (always on — they ARE the map)
  scene.add(polysMesh(map.ocean, 0x0d1319, -0.05));
  scene.add(polysMesh(map.water, 0x0e161d, -0.045));

  // toggleable layers
  layers.roads = new THREE.Group();
  layers.roads.add(linesMesh(map.roads_major, 0x565b50, 0.85, 0.015));
  layers.roads.add(linesMesh(map.roads_minor, 0x3a3d36, 0.6, 0.012));
  scene.add(layers.roads);

  layers.rail = linesMesh(map.rail, 0x6b5a4a, 0.55, 0.014);
  layers.rail.visible = false;
  scene.add(layers.rail);

  layers.lga = linesMesh(map.lga, 0x2f4a3a, 0.7, 0.013);
  layers.lga.visible = false;
  scene.add(layers.lga);

  // district tint pools + labels
  layers.labels = new THREE.Group();
  for (const key of ORDER) {
    const d = DISTRICTS[key];
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(d.r + 1.2, 40),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(state.personas[key].color),
        transparent: true, opacity: 0.08, side: THREE.DoubleSide,
      }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(d.anchor[0], -0.01, d.anchor[1]);
    if (d.rz) pool.scale.set(1, d.rz / d.r, 1);
    layers.labels.add(pool);
    layers.labels.add(
      makeLabel(d.label, d.anchor[0], d.anchor[1] + (d.rz ? d.rz : d.r) + 2.6));
  }
  layers.labels.add(makeLabel("Lagos Lagoon", 26, -8, 0.5));
  layers.labels.add(makeLabel("Atlantic", 10, 38, 0.45));
  scene.add(layers.labels);
}

function makeLabel(text, x, z, alpha = 0.9) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 96;
  const ctx = c.getContext("2d");
  ctx.font = "600 44px 'Space Grotesk', 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(225,222,210," + alpha + ")";
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 10;
  ctx.fillText(text.toUpperCase(), 256, 48);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthTest: false, opacity: 0.95,
  }));
  spr.scale.set(15, 2.8, 1);
  spr.position.set(x, 1.6, z);
  spr.renderOrder = 5;
  return spr;
}

/* ================= three.js ================= */
const H_SCALE = 11;

function initThree(map) {
  const wrap = document.getElementById("popCanvas");
  const W = wrap.clientWidth, H = wrap.clientHeight;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b0b0a, MAP_W * 1.5, MAP_W * 3.4);

  const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, MAP_W * 6);
  camera.position.set(-14, MAP_W * 0.42, MAP_W * 0.62);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(W, H);
  wrap.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2, -4);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minDistance = 18;
  controls.maxDistance = MAP_W * 1.6;
  controls.autoRotate = !REDUCED;
  controls.autoRotateSpeed = 0.45;
  controls.addEventListener("start", () => { controls.autoRotate = false; });

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.15);
  sun.position.set(40, 80, 30);
  scene.add(sun);

  buildStage(scene, map);

  const geo = new THREE.BoxGeometry(0.85, 1, 0.85);
  geo.translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), pop.agents.length);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(pop.agents.length * 3), 3);
  scene.add(mesh);

  pop.three = { scene, camera, renderer, controls, mesh, wrap };

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
      const t = Math.floor(pop.tf);
      tip.replaceChildren();
      const b = document.createElement("b");
      b.textContent = state.personas[ag.key].name + " · " + DISTRICTS[ag.key].label +
        " · household #" + (ag.id + 1);
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

  const clock = new THREE.Clock();
  (function loop() {
    requestAnimationFrame(loop);
    const dt = clock.getDelta();
    if (pop.playing) {
      const slow = performance.now() < pop.slowUntil ? 0.4 : 1;
      pop.tf += (dt * 1000 * pop.speed * slow) / MONTH_MS;
      if (pop.tf >= MONTHS - 1) {
        pop.tf = MONTHS - 1;
        play(false);
        showEndCard();
      }
      checkMoments();
      paintFrame();
    }
    controls.update();
    renderer.render(scene, camera);
  })();
}

/* ================= painting (tweened) ================= */
const _m4 = new THREE.Matrix4();
const _c = new THREE.Color();
const _tint = new THREE.Color();

function paintFrame() {
  const { mesh } = pop.three;
  const t = Math.min(MONTHS - 2, Math.floor(pop.tf));
  const frac = Math.min(1, pop.tf - t);
  const ease = frac * frac * (3 - 2 * frac);   // smoothstep for colour changes
  const now = performance.now();

  // shock/stabilizer ripple front sweeping west → east
  let front = null, rippleCol = null;
  if (pop.ripple && !REDUCED) {
    const age = now - pop.ripple.start;
    if (age < 1700) {
      front = -80 + (age / 1700) * 175;
      rippleCol = pop.ripple.kind === "shock" ? RIPPLE_RED : RIPPLE_GREEN;
    } else pop.ripple = null;
  }

  for (let i = 0; i < pop.agents.length; i++) {
    const ag = pop.agents[i];
    const s0 = ag.status[t], s1 = ag.status[t + 1];
    let h = (ag.height[t] + (ag.height[t + 1] - ag.height[t]) * frac) * H_SCALE;

    _c.copy(ST_COLOR[s0]);
    if (s1 !== s0) {
      _c.lerp(ST_COLOR[s1], ease);
      if (s1 === ST.DEAD) h *= 1 - 0.1 * Math.sin(frac * Math.PI);          // slump
      if (s1 === ST.DONE && !REDUCED) _c.lerp(WHITE, 0.5 * Math.sin(frac * Math.PI)); // glow
    }
    if (front !== null) {
      const dx = Math.abs(ag.x - front);
      if (dx < 14) _c.lerp(_tint.copy(rippleCol), (1 - dx / 14) * 0.8);
    }

    _m4.makeScale(1, Math.max(0.25, h), 1);
    _m4.setPosition(ag.x, 0, ag.z);
    mesh.setMatrixAt(i, _m4);
    mesh.setColorAt(i, _c);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;

  const month = Math.floor(pop.tf);
  if (month !== pop.lastMonth) {
    pop.lastMonth = month;
    updateReadout(month);
  }
}

/* ================= cinematic moments ================= */
function checkMoments() {
  // year chyron
  const year = Math.floor(pop.tf / 12) + 1;
  if (year !== pop.lastYear) {
    pop.lastYear = year;
    const ch = document.getElementById("popChyron");
    ch.classList.remove("is-on");
    ch.textContent = "YEAR " + year;
    requestAnimationFrame(() => requestAnimationFrame(() => ch.classList.add("is-on")));
  }
  // event banner + ripple + dramatic slowdown when the hit month arrives
  const T = pop.when * 12;
  if (pop.active.size && pop.tf >= T && pop.bannerShownFor !== T) {
    pop.bannerShownFor = T;
    const evs = [...pop.active].map((id) => window.ML_EVENTS[id]);
    const anyShock = evs.some((e) => e.kind === "shock");
    const banner = document.getElementById("popBanner");
    banner.textContent = evs.map((e) => e.icon + " " + e.label).join("  ·  ");
    banner.classList.toggle("stab-banner", !anyShock);
    banner.hidden = false;
    banner.classList.add("is-on");
    setTimeout(() => banner.classList.remove("is-on"), 2600);
    setTimeout(() => { banner.hidden = true; }, 3100);
    if (!REDUCED) {
      pop.slowUntil = performance.now() + 2400;
      pop.ripple = { start: performance.now(), kind: anyShock ? "shock" : "stab" };
    }
  }
}

function showEndCard() {
  const counts = countsAt(MONTHS - 1);
  const end = document.getElementById("popEnd");
  end.replaceChildren();
  const txt = document.createElement("span");
  const b = document.createElement("b");
  b.textContent = "Seven years pass. ";
  txt.append(b, document.createTextNode(
    `${counts.completed} dreams completed · ${counts.dead} dreams died · ` +
    `${counts.drowning} households never surfaced · ${counts.leaking} still leaking.`));
  const btn = document.createElement("button");
  btn.textContent = "⟲ Replay";
  btn.addEventListener("click", () => {
    end.hidden = true;
    pop.tf = 0; pop.lastYear = 0; pop.bannerShownFor = -1;
    play(true);
  });
  end.append(txt, btn);
  end.hidden = false;
}

/* ================= readout ================= */
function countsAt(t) {
  const c = { building: 0, coping: 0, leaking: 0, dead: 0, drowning: 0, completed: 0 };
  for (const ag of pop.agents) {
    const s = ag.status[t];
    if (s === ST.BUILDING || s === ST.SURGING) c.building++;
    else if (s === ST.LEAKING) c.leaking++;
    else if (s === ST.DEAD) c.dead++;
    else if (s === ST.DROWNING) c.drowning++;
    else if (s !== ST.DONE) c.coping++;
    if (ag.completedAt >= 0 && ag.completedAt <= t) c.completed++;
  }
  return c;
}

function updateReadout(t) {
  const c = countsAt(t);
  const wrap = document.getElementById("popCounts");
  wrap.replaceChildren();
  const stats = [
    ["Dreams completed", c.completed, "#7ee04e"],
    ["Building this month", c.building, "#3f9a2f"],
    ["Just surviving", c.coping, "#98958a"],
    ["Leaking", c.leaking, "#e66767"],
    ["Dreams dead", c.dead, "#8a4b3d"],
    ["Drowning (no dream)", c.drowning, "#c2372f"],
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

/* ================= controls ================= */
function setMonth(t) {
  pop.tf = Math.max(0, Math.min(MONTHS - 1, t));
  pop.bannerShownFor = pop.tf >= pop.when * 12 ? pop.when * 12 : -1;
  // keep the chyron honest when scrubbing while paused
  pop.lastYear = Math.floor(pop.tf / 12) + 1;
  const ch = document.getElementById("popChyron");
  ch.textContent = "YEAR " + pop.lastYear;
  ch.classList.add("is-on");
  paintFrame();
}

function play(on) {
  pop.playing = on;
  document.getElementById("popPlay").textContent = on ? "❚❚ Pause" : "▶ Play";
  if (on && pop.tf >= MONTHS - 1.01) {
    pop.tf = 0; pop.lastYear = 0; pop.bannerShownFor = -1;
    document.getElementById("popEnd").hidden = true;
  }
}

function buildEventChips() {
  for (const [id, ev] of Object.entries(window.ML_EVENTS)) {
    const wrap = document.getElementById(ev.kind === "shock" ? "popShockBtns" : "popStabBtns");
    const b = document.createElement("button");
    b.className = "sim-btn " + (ev.kind === "shock" ? "shock" : "stab");
    b.dataset.id = id;   // lets the guided tour find a specific chip (matches simulator.js)
    b.textContent = ev.icon + " " + ev.label;
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => {
      if (pop.active.has(id)) pop.active.delete(id); else pop.active.add(id);
      b.classList.toggle("is-on", pop.active.has(id));
      b.setAttribute("aria-pressed", String(pop.active.has(id)));
      pop.bannerShownFor = -1;
      simulateAll();
      paintFrame();
      updateReadout(Math.floor(pop.tf));
    });
    wrap.appendChild(b);
  }
  const slider = document.getElementById("popWhenSlider");
  slider.addEventListener("input", () => {
    pop.when = +slider.value;
    document.getElementById("popWhenLabel").textContent = slider.value;
    pop.bannerShownFor = -1;
    simulateAll();
    paintFrame();
    updateReadout(Math.floor(pop.tf));
  });
  document.getElementById("popReset").addEventListener("click", () => {
    pop.active.clear();
    document.querySelectorAll("#popShockBtns .sim-btn, #popStabBtns .sim-btn")
      .forEach((b) => { b.classList.remove("is-on"); b.setAttribute("aria-pressed", "false"); });
    document.getElementById("popEnd").hidden = true;
    pop.lastYear = 0; pop.bannerShownFor = -1;
    simulateAll();
    setMonth(0);
    updateReadout(0);
  });
  document.getElementById("popPlay").addEventListener("click", () => play(!pop.playing));
  document.getElementById("popScrub").addEventListener("input", (ev) => {
    play(false);
    setMonth(+ev.target.value);
    updateReadout(Math.floor(pop.tf));
  });
  // speed chips
  const speeds = document.getElementById("popSpeeds");
  for (const s of [0.5, 1, 2]) {
    const b = document.createElement("button");
    b.className = "pop-speed" + (s === 1 ? " is-active" : "");
    b.textContent = s + "×";
    b.addEventListener("click", () => {
      pop.speed = s;
      speeds.querySelectorAll(".pop-speed").forEach((x) =>
        x.classList.toggle("is-active", x === b));
    });
    speeds.appendChild(b);
  }
}

function buildLegend() {
  const wrap = document.getElementById("popLegend");
  for (const key of ORDER) {
    const p = state.personas[key];
    const el = document.createElement("span");
    const i = document.createElement("i");
    i.style.background = p.color;
    el.append(i, document.createTextNode(
      `${p.name} — ${DISTRICTS[key].label} ×${MIX[key]}`));
    wrap.appendChild(el);
  }
}

/* ================= layer toggles ================= */
function buildLayerChips() {
  const wrap = document.getElementById("popLayers");
  const defs = [
    ["roads", "🛣️ Roads", true],
    ["rail", "🚆 Rail", false],
    ["lga", "🗺️ LGA boundaries", false],
    ["labels", "📍 Neighborhoods", true],
  ];
  for (const [name, label, on] of defs) {
    const b = document.createElement("button");
    b.className = "pop-speed" + (on ? " is-active" : "");
    b.textContent = label;
    b.setAttribute("aria-pressed", String(on));
    b.addEventListener("click", () => {
      layers[name].visible = !layers[name].visible;
      b.classList.toggle("is-active", layers[name].visible);
      b.setAttribute("aria-pressed", String(layers[name].visible));
    });
    wrap.appendChild(b);
  }
}

/* ================= boot ================= */
async function boot() {
  try {
    const map = await (await fetch("data/lagos_map.json")).json();
    for (const [key, h] of Object.entries(map.hoods)) {
      DISTRICTS[key].anchor = [h.x, h.z];
      DISTRICTS[key].label = h.label;
    }
    buildAgents();
    simulateAll();
    layoutAgents();
    initThree(map);
    buildEventChips();
    buildLayerChips();
    buildLegend();
    setMonth(0);
    updateReadout(0);
    if (!REDUCED) play(true);
  } catch (err) {
    const wrap = document.getElementById("popCanvas");
    wrap.textContent = "3D view unavailable here (" + err.message +
      ") — the seven-life simulator above carries the same engine.";
    wrap.style.cssText +=
      "display:flex;align-items:center;justify-content:center;color:#898781;font-size:13px;padding:20px;";
  }
}

if (window.state && Object.keys(window.state.personas || {}).length) boot();
else window.initPopulation = boot;
