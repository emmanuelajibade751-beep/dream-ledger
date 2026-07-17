# export_data.py — Phase 0 of the Interactive App. Lives in 06_Interactive_App/build/.
# Reads the seven canonical ledger workbooks (READ-ONLY, per OWNERSHIP.md) and dumps
# per-persona JSON the web app can load. Re-run any time the ledgers regenerate:
#   cd 06_Interactive_App && PYTHONIOENCODING=utf-8 py -3 build/export_data.py
import json
import os
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))          # .../06_Interactive_App/build
APP_ROOT = os.path.normpath(os.path.join(HERE, ".."))       # .../06_Interactive_App
ENGINES_OUT = os.path.normpath(os.path.join(APP_ROOT, "..", "engines", "outputs"))
DATA_DIR = os.path.join(APP_ROOT, "data")

# Persona metadata. Colors are identity slots from a validated categorical palette
# (dark-surface steps). Green/red are NOT used for identity — they stay reserved
# for the project grammar (green=dream, red=leak, grey=survival).
PERSONAS = {
    "landlord": {
        "file": "Landlord_Dream_Ledger.xlsx",
        "name": "The Landlord",
        "person": "Tunde — technician + POS agent, Ikorodu",
        "dream": "Build a house, become a landlord",
        "outcome": "reached",
        "outcome_label": "Reached the dream — cleanly",
        "color": "#3987e5",
        "story": ("Ten years of cement bags and ajo contributions. 89% of his money came "
                  "from his own work — the only fully solo dream in the set, and the one "
                  "that finished closest to its target (92.6%)."),
        "caveat": ("His climb looks slow next to the others — that is the point. Discipline "
                   "reads as a gentle slope, not a spike."),
    },
    "japa": {
        "file": "Japa_Dream_Ledger.xlsx",
        "name": "The Japa Dream",
        "person": "Chidinma — bank teller, Yaba",
        "dream": "Leave Nigeria (visa, proof-of-funds, ticket)",
        "outcome": "reached",
        "outcome_label": "Departed — but drained",
        "color": "#199e70",
        "story": ("38% of her income is family rallying behind her. Proof-of-funds means "
                  "the money must sit still in the account — so her dream line stays low "
                  "while her savings do the real work."),
        "caveat": ("Her 'dream progress' looks tiny (19.4%) only because the target — a full "
                   "exit — is enormous relative to a teller's salary. Read her savings, not "
                   "her dream spend."),
    },
    "ama": {
        "file": "AMA_Dream_Ledger.xlsx",
        "name": "AMA — “Make It”",
        "person": "Tunde Balogun — dispatch rider, Agege",
        "dream": "Quick money — ₦2m in the account",
        "outcome": "failed",
        "outcome_label": "Never reached it — ends in the red",
        "color": "#d95926",
        "story": ("24 of every ₦100 he spends leaks to betting, Aviator and a Ponzi "
                  "crash. His dream line barely leaves the floor: the money leaks before "
                  "it ever reaches the dream."),
        "caveat": ("A flat line here is honest, not missing data. This is what failure "
                   "looks like in ledger form — the loser-majority case."),
    },
    "kids_abroad": {
        "file": "Kids_Abroad_Dream_Ledger.xlsx",
        "name": "Kids Abroad",
        "person": "The Adeyemi household — child to a UK university",
        "dream": "A UK degree for Tobi",
        "outcome": "pyrrhic",
        "outcome_label": "Reached the dream — at ruin",
        "color": "#9085e9",
        "story": ("The rocket line. The degree is priced in pounds, and the naira collapsed "
                  "₦460 → ₦2,050/£ mid-journey — so every instalment ballooned. "
                  "₦66.3m spent: more than the other four dreams combined."),
        "caveat": ("The steep rise is NOT compounding or success — it is the exchange rate "
                   "inflating the cost of the same degree. A shock wearing the costume of "
                   "growth."),
    },
    "coping_control": {
        "file": "Coping_Control_Dream_Ledger.xlsx",
        "name": "The Control",
        "person": "Mama Bisi household — kiosk + okada, Mushin",
        "dream": "No dream — survival takes everything first",
        "outcome": "control",
        "outcome_label": "No dream to lose",
        "color": "#98958a",
        "story": ("The baseline every dream is read against. Seven years of kiosk takings and "
                  "okada money, all of it eaten by generator fuel, pure water, security levies, "
                  "rent advance and clinic emergencies. The ajo is broken every eight months. "
                  "The dream line is flat at zero — honestly."),
        "caveat": ("This household isn't failing — it's coping. That IS the finding: when every "
                   "guarantee is withdrawn, surplus becomes survival, and the dream never gets "
                   "to start."),
    },
    "dollar_earner": {
        "file": "Dollar_Earner_Dream_Ledger.xlsx",
        "name": "The Dollar Earner",
        "person": "Deji — remote developer, Surulere → Lekki",
        "dream": "Japa without leaving — a currency-proof career",
        "outcome": "reached",
        "outcome_label": "Winning — paid in dollars",
        "color": "#c98500",
        "story": ("Salary in USD at a rate that rose ₦360 → ₦1,550. His income line bends UP in "
                  "2023–24 exactly where Kids Abroad's costs exploded — the same crash, opposite "
                  "side. Land at Epe, an apartment deposit, $1,300/month into the dom account."),
        "caveat": ("His win is currency exposure, not extraordinary discipline — the mirror image "
                   "of Kids Abroad's ruin. A stable naira would quietly cut his converted salary."),
    },
    "instagrammer": {
        "file": "Instagrammer_Dream_Ledger.xlsx",
        "name": "The Instagrammer",
        "person": "Zizi — aspiring influencer, Lekki",
        "dream": "Become the brand — fame that pays",
        "outcome": "projection",
        "outcome_label": "Still a projection — 222:1 facade",
        "color": "#d55181",
        "story": ("99.8% of her days end in the red, kept afloat by ₦22.8m of bailouts. "
                  "Her feed projects ₦242m of life against ₦1.1m of real brand income. "
                  "In reality some creators do break through and get wealthy — the simulator "
                  "will let you trigger that breakthrough."),
        "caveat": ("Her spending is real; her wealth is performed. The dream line measures "
                   "content investment, not assets you could sell."),
    },
}


# Artifact groupings per persona — the "Menzel board" tiles. Rules are checked in
# order; first substring match on the Item wins. tag limits the rule to Dream or
# Diversion rows so e.g. "importation" can be a dream purchase AND a scam loss.
ARTIFACT_RULES = {
    "landlord": [
        ("Finishing", "🏠", "Dream", ["Finishing"]),
        ("Walls", "🧱", "Dream", ["Walls"]),
        ("Foundation", "🏗️", "Dream", ["Foundation"]),
        ("Roof", "🛠️", "Dream", ["Roof"]),
        ("Cement", "🪨", "Dream", ["cement"]),
        ("Land (600sqm)", "📍", "Dream", ["Land installment"]),
        ("Fence", "🚧", "Dream", ["Fence"]),
        ("Survey + docs", "📋", "Dream", ["Survey"]),
        ("Coop loan repaid", "🤝", "Dream", ["Cooperative loan"]),
        ("Betting", "🎰", "Diversion", ["Sports bet"]),
        ("Owambe outings", "🎉", "Diversion", ["owambe", "Club"]),
    ],
    "japa": [
        ("Flight to Toronto", "✈️", "Dream", ["One-way flight"]),
        ("Settlement cash", "💼", "Dream", ["Settlement cash"]),
        ("Relocation consultant", "🧭", "Dream", ["relocation consultant"]),
        ("IELTS (×2 + prep)", "📚", "Dream", ["IELTS"]),
        ("Passport", "🛂", "Dream", ["passport"]),
        ("Study permit", "📄", "Dream", ["study permit"]),
        ("Medical + clearance", "🩺", "Dream", ["medical"]),
        ("Scam agent — LOST", "🕳️", "Diversion", ["Scam agent"]),
        ("Betting", "🎰", "Diversion", ["Sports bet"]),
        ("Outings", "🎉", "Diversion", ["Outing"]),
    ],
    "ama": [
        ("Sports betting", "🎰", "Diversion", ["Sports bet"]),
        ("Aviator / casino", "🎲", "Diversion", ["casino", "Aviator"]),
        ("Ponzi collapse", "🕳️", "Diversion", ["MMM"]),
        ("Import order scammed", "📦", "Diversion", ["never arrives"]),
        ("Outings", "🍻", "Diversion", ["Outing"]),
        ("iPhones (status)", "📱", "Dream", ["iPhone"]),
        ("Mini-importation", "📦", "Dream", ["importation"]),
        ("Phone-flip stock", "🔁", "Dream", ["Phone-flip"]),
        ("Big-boy kit", "👟", "Dream", ["Big-boy"]),
    ],
    "kids_abroad": [
        ("Tuition (GBP)", "🎓", "Dream", ["tuition", "Tuition"]),
        ("Tobi's upkeep", "🍲", "Dream", ["upkeep"]),
        ("Visa + IHS", "🛂", "Dream", ["visa"]),
        ("Flight to London", "✈️", "Dream", ["flight"]),
        ("Education consultant", "🧭", "Dream", ["consultant"]),
        ("Forex bureau premium", "💱", "Diversion", ["Bureau premium"]),
    ],
    "instagrammer": [
        ("BNPL gear (owing)", "📱", "Dream", ["bought on BNPL"]),
        ("Performed lifestyle", "🎭", "Dream", ["Real cost"]),
        ("Glam: makeup + hair", "💄", "Dream", ["Glam"]),
        ("Photographer", "📸", "Dream", ["Photographer"]),
        ("Boosted posts (ads)", "📢", "Dream", ["Boost the post"]),
        ("BNPL instalments", "🧾", "Diversion", ["Buy-now-pay-later"]),
        ("Designer splurges", "👜", "Diversion", ["designer splurge"]),
    ],
    # The control has no Dream rows — its board shows what SURVIVAL bought (Coping tag).
    "coping_control": [
        ("Generator + fuel", "⛽", "Coping", ["Generator", "generator"]),
        ("Water (sachets + vendor)", "💧", "Coping", ["water", "Water"]),
        ("NEPA bills", "🔌", "Coping", ["NEPA"]),
        ("Security levy", "🛡️", "Coping", ["Security"]),
        ("Clinic emergencies", "🩺", "Coping", ["Clinic"]),
        ("Flood damage", "🌊", "Coping", ["Flood"]),
        ("Loan interest", "🧾", "Coping", ["Interest"]),
        ("Lotto tickets", "🎫", "Diversion", ["Lotto"]),
        ("Miracle seeds", "🕳️", "Diversion", ["Miracle seed"]),
    ],
    "dollar_earner": [
        ("The rig (MacBooks + desk)", "💻", "Dream", ["MacBook", "Monitor"]),
        ("Starlink uplink", "📡", "Dream", ["Starlink"]),
        ("Courses + certs", "📚", "Dream", ["Course"]),
        ("Coworking desk", "🪑", "Dream", ["Coworking"]),
        ("Land — Epe", "📍", "Dream", ["Land installment"]),
        ("Apartment deposit", "🏢", "Dream", ["Apartment"]),
        ("Crypto punts + rug pull", "🪙", "Diversion", ["Crypto", "NFT", "rug pull"]),
    ],
}


def month_index(start, ts):
    return (ts.year - start.year) * 12 + (ts.month - start.month)


KIND_BY_TAG = {"Dream": "dream", "Diversion": "leak", "Coping": "coping"}


def build_artifacts(key, daily):
    """Group transactions into Menzel-board tiles. Dream+Diversion by default;
    a persona's rules may also pull in Coping (the control's board shows what
    survival bought)."""
    rules = ARTIFACT_RULES[key]
    tags = {"Dream", "Diversion"} | {r[2] for r in rules}
    rows = daily[daily["Ledger"].isin(tags)]
    tiles = {}
    for _, r in rows.iterrows():
        item = str(r["Item"])
        tag = r["Ledger"]
        hit = None
        for label, icon, rtag, pats in rules:
            if rtag == tag and any(p.lower() in item.lower() for p in pats):
                hit = (label, icon, tag)
                break
        if hit is None:
            fallback = {"Diversion": "Other leaks", "Coping": "Other coping",
                        "Dream": "Other dream bits"}
            hit = (fallback[tag], "▫️", tag)
        label, icon, tag = hit
        t = tiles.setdefault(label, {
            "label": label, "icon": icon,
            "kind": KIND_BY_TAG[tag],
            "total": 0.0, "count": 0, "first": None, "last": None,
        })
        t["total"] += abs(float(r["Amount_NGN"]))
        t["count"] += 1
        d = str(r["Date"])[:10]
        t["first"] = d if t["first"] is None or d < t["first"] else t["first"]
        t["last"] = d if t["last"] is None or d > t["last"] else t["last"]
    out = sorted(tiles.values(), key=lambda t: -t["total"])
    for t in out:
        t["total"] = round(t["total"], 0)
    return out


def build_weeks(daily, start, milestones):
    """Per-week dream/leak detail for the interactive heatmap. Week index is
    journey-based (days since start // 7) so every persona aligns at week 0."""
    d = daily.copy()
    d["Date"] = pd.to_datetime(d["Date"])
    d["wi"] = ((d["Date"] - start).dt.days // 7).clip(lower=0)
    n_weeks = int(d["wi"].max()) + 1

    dream = d[d["Ledger"] == "Dream"].groupby("wi")["Amount_NGN"].sum().abs()
    leak = d[d["Ledger"] == "Diversion"].groupby("wi")["Amount_NGN"].sum().abs()

    def top_item(tag):
        sub = d[d["Ledger"] == tag].copy()
        sub["amt"] = sub["Amount_NGN"].abs()
        g = sub.groupby(["wi", "Item"])["amt"].sum().reset_index()
        idx = g.groupby("wi")["amt"].idxmax()
        return {int(r["wi"]): str(r["Item"]) for _, r in g.loc[idx].iterrows()}

    top_dream = top_item("Dream")
    top_leak = top_item("Diversion")
    ms_weeks = {}
    for ms in milestones:
        wi = max(0, (pd.to_datetime(ms["date"]) - start).days // 7)
        ms_weeks[int(min(wi, n_weeks - 1))] = ms["item"]

    weeks = []
    for wi in range(n_weeks):
        dv = float(dream.get(wi, 0.0))
        lv = float(leak.get(wi, 0.0))
        score = 0.0 if (dv + lv) < 1500 else (dv - lv) / (dv + lv)
        wk = {
            "w": wi,
            "date": (start + pd.Timedelta(days=int(wi) * 7)).strftime("%Y-%m-%d"),
            "dream": round(dv, 0),
            "leak": round(lv, 0),
            "score": round(score, 3),
        }
        if wi in top_dream and dv > 0:
            wk["td"] = top_dream[wi]
        if wi in top_leak and lv > 0:
            wk["tl"] = top_leak[wi]
        if wi in ms_weeks:
            wk["ms"] = ms_weeks[wi]
        weeks.append(wk)
    return weeks


def export_persona(key, meta):
    path = os.path.join(ENGINES_OUT, meta["file"])
    monthly = pd.read_excel(path, sheet_name="Monthly_Summary")
    weekly = pd.read_excel(path, sheet_name="Weekly_Summary")
    progress = pd.read_excel(path, sheet_name="Dream_Progress")

    # Monthly_Summary "Month" may be a Timestamp or a "YYYY-MM" string.
    months = pd.to_datetime(monthly["Month"].astype(str), format="mixed")
    start = months.iloc[0]

    out = {
        "key": key,
        "name": meta["name"],
        "person": meta["person"],
        "dream": meta["dream"],
        "outcome": meta["outcome"],
        "outcome_label": meta["outcome_label"],
        "color": meta["color"],
        "story": meta["story"],
        "caveat": meta["caveat"],
        "start_month": start.strftime("%Y-%m"),
        "monthly": [],
        "milestones": [],
        "weekly_pulse": [],  # for the Phase-2 heatmap: dream-vs-leak score per week
    }

    for i, row in monthly.iterrows():
        out["monthly"].append({
            "m": int(i),
            "date": months.iloc[i].strftime("%Y-%m"),
            "income": round(float(row["Income"]), 2),
            "essential": round(float(row["Essential"]), 2),
            "coping": round(float(row["Coping"]), 2),
            "dream": round(float(row["Dream"]), 2),
            "savings": round(float(row["Savings"]), 2),
            "diversion": round(float(row["Diversion"]), 2),
            "social": round(float(row["Social"]), 2),
            "balance": round(float(row["End_Balance"]), 2),
            "dream_cum": round(float(row["Dream_Cumulative"]), 2),
        })

    for _, row in progress.iterrows():
        ts = pd.to_datetime(str(row["Date"]))
        mi = max(0, min(month_index(start, ts), len(out["monthly"]) - 1))
        out["milestones"].append({
            "m": mi,
            "date": ts.strftime("%Y-%m-%d"),
            "age": int(row["Age"]),
            "item": str(row["Item"]),
            "note": str(row["Note"]),
            "ngn": float(row["Dream_Asset_NGN"]),
            "pct": float(row["Pct_of_2025_target"]),
        })

    # Weekly pulse: same score formula the life heatmap uses (see READING_GUIDE §1).
    for _, row in weekly.iterrows():
        d = abs(float(row["Dream"]))
        l = abs(float(row["Diversion"]))
        score = 0.0 if (d + l) < 1500 else (d - l) / (d + l)
        out["weekly_pulse"].append(round(score, 3))

    # Phase 2: rich weekly detail (heatmap hovers) + Menzel artifact tiles.
    daily = pd.read_csv(os.path.join(ENGINES_OUT, meta["file"].replace(".xlsx", "_daily.csv")))
    out["weeks"] = build_weeks(daily, start, out["milestones"])
    out["artifacts"] = build_artifacts(key, daily)

    fn = os.path.join(DATA_DIR, f"{key}.json")
    with open(fn, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    # Null-check the write (the LLL folder has truncated large writes before).
    with open(fn, encoding="utf-8") as f:
        json.load(f)
    return len(out["monthly"]), len(out["milestones"])


def main():
    index = []
    for key, meta in PERSONAS.items():
        n_months, n_miles = export_persona(key, meta)
        index.append({"key": key, "name": meta["name"], "color": meta["color"],
                      "months": n_months, "milestones": n_miles})
        print(f"exported {key}: {n_months} months, {n_miles} milestones")
    with open(os.path.join(DATA_DIR, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False)
    print("index.json written")


if __name__ == "__main__":
    main()
