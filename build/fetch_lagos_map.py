# fetch_lagos_map.py - pulls real Lagos geometry from OpenStreetMap (Overpass API)
# and writes data/lagos_map.json in the app's local map units.
# Layers: ocean (from natural=coastline), water (lagoon/creeks), roads
# (motorway/trunk/primary), rail, LGA boundaries (admin_level=6).
# Map data (c) OpenStreetMap contributors, ODbL - credited in the app UI.
#   cd 06_Interactive_App && PYTHONIOENCODING=utf-8 py -3 build/fetch_lagos_map.py
# Lives in 06_Interactive_App/build/ ; writes to ../data/lagos_map.json.
import json
import math
import os
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))          # .../06_Interactive_App/build
APP_ROOT = os.path.normpath(os.path.join(HERE, ".."))       # .../06_Interactive_App
OUT = os.path.join(APP_ROOT, "data", "lagos_map.json")

# bbox (lat S, lon W, lat N, lon E) - covers Agege..Ikorodu..Lekki + lagoon + VI
S, W, N, E = 6.36, 3.10, 6.70, 3.65
BBOX = f"{S},{W},{N},{E}"

# local projection: x east, z south (three.js plan view), ~2.47 units per km
LAT0, LON0 = (S + N) / 2, (W + E) / 2
KM_PER_DEG = 110.574
UNITS_PER_KM = 150.0 / ((E - W) * KM_PER_DEG * math.cos(math.radians(LAT0)))

def proj(lon, lat):
    x = (lon - LON0) * KM_PER_DEG * math.cos(math.radians(LAT0)) * UNITS_PER_KM
    z = -(lat - LAT0) * KM_PER_DEG * UNITS_PER_KM
    return (round(x, 2), round(z, 2))

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

def overpass(query, tries=3):
    q = f"[out:json][timeout:120];{query}"
    for attempt in range(tries):
        ep = ENDPOINTS[attempt % len(ENDPOINTS)]
        try:
            req = urllib.request.Request(
                ep, data=q.encode(), headers={"User-Agent": "MoneyLens-research/1.0"})
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r)
        except Exception as e:
            print(f"  attempt {attempt+1} failed on {ep}: {e}")
            time.sleep(8)
    raise RuntimeError("overpass failed")

# ---------- geometry helpers ----------
def rdp(pts, eps):
    """Ramer-Douglas-Peucker simplification."""
    if len(pts) < 3:
        return pts
    ax, ay = pts[0]; bx, by = pts[-1]
    dmax, idx = 0.0, 0
    dx, dy = bx - ax, by - ay
    L = math.hypot(dx, dy) or 1e-12
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        d = abs(dx * (ay - py) - dy * (ax - px)) / L
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        left = rdp(pts[:idx + 1], eps)
        return left[:-1] + rdp(pts[idx:], eps)
    return [pts[0], pts[-1]]

def clip_poly(pts, s, w, n, e):
    """Sutherland-Hodgman clip of a ring (lon,lat) to bbox."""
    def clip_edge(poly, inside, intersect):
        out = []
        for i, cur in enumerate(poly):
            prev = poly[i - 1]
            ci, pi = inside(cur), inside(prev)
            if ci:
                if not pi:
                    out.append(intersect(prev, cur))
                out.append(cur)
            elif pi:
                out.append(intersect(prev, cur))
        return out
    def ix_v(x):
        def f(p, c):
            t = (x - p[0]) / (c[0] - p[0])
            return (x, p[1] + t * (c[1] - p[1]))
        return f
    def ix_h(y):
        def f(p, c):
            t = (y - p[1]) / (c[1] - p[1])
            return (p[0] + t * (c[0] - p[0]), y)
        return f
    poly = pts
    for inside, ix in [
        (lambda p: p[0] >= w, ix_v(w)), (lambda p: p[0] <= e, ix_v(e)),
        (lambda p: p[1] >= s, ix_h(s)), (lambda p: p[1] <= n, ix_h(n)),
    ]:
        poly = clip_edge(poly, inside, ix)
        if len(poly) < 3:
            return []
    return poly

def join_ways(ways):
    """Join open ways sharing endpoints into long strings; return closed + open."""
    segs = [list(w) for w in ways if len(w) >= 2]
    strings = []
    while segs:
        cur = segs.pop()
        changed = True
        while changed:
            changed = False
            for i, s2 in enumerate(segs):
                if cur[-1] == s2[0]:
                    cur += s2[1:]
                elif cur[-1] == s2[-1]:
                    cur += list(reversed(s2))[1:]
                elif cur[0] == s2[-1]:
                    cur = s2[:-1] + cur
                elif cur[0] == s2[0]:
                    cur = list(reversed(s2))[:-1] + cur
                else:
                    continue
                segs.pop(i)
                changed = True
                break
        strings.append(cur)
    return strings

def ring_area(pts):
    a = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % len(pts)]
        a += x1 * y2 - x2 * y1
    return a / 2

def point_in_poly(pt, poly):
    x, y = pt
    inside = False
    for i in range(len(poly)):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % len(poly)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside

def way_coords(el):
    return [(g["lon"], g["lat"]) for g in el.get("geometry", []) if g]

def diag_km(pts):
    lons = [p[0] for p in pts]; lats = [p[1] for p in pts]
    return math.hypot((max(lons) - min(lons)) * KM_PER_DEG * 0.994,
                      (max(lats) - min(lats)) * KM_PER_DEG)

EPS_WATER = 0.0007   # ~78 m
EPS_LINE = 0.0005

def to_local_ring(pts, eps):
    pts = rdp(pts, eps)
    return [proj(lon, lat) for lon, lat in pts]

# ---------- 1. ocean from coastline ----------
print("1/5 coastline ...")
data = overpass(f'way["natural"="coastline"]({BBOX});out geom;')
ways = [way_coords(el) for el in data["elements"]]
print(f"  {len(ways)} coastline ways")
strings = join_ways(ways)
strings.sort(key=len, reverse=True)
ocean_polys = []
if strings:
    main = max(strings, key=lambda st: diag_km(st))
    # clip string to bbox by keeping in-bbox runs of the longest string
    inb = [(lon, lat) for lon, lat in main if W - 0.01 <= lon <= E + 0.01 and S - 0.01 <= lat <= N + 0.01]
    if len(inb) >= 2:
        # OSM rule: water is on the RIGHT of the way direction.
        # close the polygon along the bbox edge; test with a known ocean point.
        ocean_pt = (3.40, 6.38)   # off Bar Beach, definitely Atlantic
        cand = inb + [(inb[-1][0], S), (inb[0][0], S)]
        ring = clip_poly(cand, S, W, N, E)
        if ring and not point_in_poly(ocean_pt, ring):
            cand = inb + [(inb[-1][0], N), (inb[0][0], N)]
            ring = clip_poly(cand, S, W, N, E)
        if ring and point_in_poly(ocean_pt, ring):
            ocean_polys.append(to_local_ring(ring, EPS_WATER))
            print(f"  ocean polygon: {len(ocean_polys[0])} pts")
        else:
            print("  WARN: could not orient ocean polygon; skipping")

# ---------- 2. lagoon + creeks ----------
print("2/5 water bodies ...")
data = overpass(
    f'(way["natural"="water"]({BBOX});relation["natural"="water"]({BBOX}););out geom;')
water_polys = []
for el in data["elements"]:
    rings = []
    if el["type"] == "way":
        pts = way_coords(el)
        if len(pts) >= 4 and pts[0] == pts[-1]:
            rings = [pts]
    else:
        outers = [way_coords(m) for m in el.get("members", [])
                  if m.get("role") == "outer" and m.get("geometry")]
        rings = [r for r in join_ways(outers) if len(r) >= 4]
    for r in rings:
        if diag_km(r) < 1.2:
            continue                      # skip ponds
        r = clip_poly(r, S, W, N, E)
        if len(r) >= 4:
            water_polys.append(to_local_ring(r, EPS_WATER))
water_polys.sort(key=len, reverse=True)
water_polys = water_polys[:40]
print(f"  {len(water_polys)} water polygons kept")

# ---------- 3. roads ----------
print("3/5 roads ...")
data = overpass(f'way["highway"~"^(motorway|trunk|primary)$"]({BBOX});out geom;')
roads_major, roads_minor = [], []
for el in data["elements"]:
    pts = way_coords(el)
    if len(pts) < 2:
        continue
    line = to_local_ring(pts, EPS_LINE)
    if len(line) >= 2:
        (roads_major if el.get("tags", {}).get("highway") in ("motorway", "trunk")
         else roads_minor).append(line)
print(f"  {len(roads_major)} major, {len(roads_minor)} primary")

# ---------- 4. rail ----------
print("4/5 rail ...")
data = overpass(f'way["railway"="rail"]({BBOX});out geom;')
rail = []
for el in data["elements"]:
    pts = way_coords(el)
    if len(pts) >= 2:
        line = to_local_ring(pts, EPS_LINE)
        if len(line) >= 2:
            rail.append(line)
print(f"  {len(rail)} rail ways")

# ---------- 5. LGA boundaries ----------
print("5/5 LGA boundaries ...")
data = overpass(
    f'relation["boundary"="administrative"]["admin_level"="8"]({BBOX});out geom;')
if not data["elements"]:
    data = overpass(
        f'relation["boundary"="administrative"]["admin_level"="6"]({BBOX});out geom;')
seen = set()
lga = []
for el in data["elements"]:
    for m in el.get("members", []):
        if m.get("type") == "way" and m.get("geometry") and m.get("ref") not in seen:
            seen.add(m.get("ref"))
            pts = [(g["lon"], g["lat"]) for g in m["geometry"]]
            pts = [(lon, lat) for lon, lat in pts
                   if W - 0.02 <= lon <= E + 0.02 and S - 0.02 <= lat <= N + 0.02]
            if len(pts) >= 2:
                line = to_local_ring(pts, EPS_LINE * 1.6)
                if len(line) >= 2:
                    lga.append(line)
print(f"  {len(lga)} boundary segments")

# ---------- neighborhoods (real coordinates) ----------
HOODS = {
    "coping_control": {"label": "Mushin",   "lon": 3.354, "lat": 6.527},
    "ama":            {"label": "Agege",    "lon": 3.320, "lat": 6.615},
    "landlord":       {"label": "Ikorodu",  "lon": 3.508, "lat": 6.616},
    "japa":           {"label": "Yaba",     "lon": 3.378, "lat": 6.507},
    "kids_abroad":    {"label": "Gbagada",  "lon": 3.389, "lat": 6.552},
    "dollar_earner":  {"label": "Surulere", "lon": 3.358, "lat": 6.500},
    "instagrammer":   {"label": "Lekki",    "lon": 3.474, "lat": 6.447},
}
hoods = {}
for k, h in HOODS.items():
    x, z = proj(h["lon"], h["lat"])
    hoods[k] = {"label": h["label"], "x": x, "z": z}

out = {
    "attribution": "Map data (c) OpenStreetMap contributors (ODbL)",
    "bbox_units": [proj(W, N), proj(E, S)],   # [x_min,z_min],[x_max,z_max]
    "ocean": ocean_polys,
    "water": water_polys,
    "roads_major": roads_major,
    "roads_minor": roads_minor,
    "rail": rail,
    "lga": lga,
    "hoods": hoods,
}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, separators=(",", ":"))
size = os.path.getsize(OUT) / 1024
print(f"wrote {OUT} ({size:.0f} KB)")
