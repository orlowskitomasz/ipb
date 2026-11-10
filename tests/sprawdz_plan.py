#!/usr/bin/env python3
"""Sprawdza plan IPB (plan.json) względem profilu biegacza (profil.json).

Użycie:
  python3 tests/sprawdz_plan.py PROFIL.json PLAN.json   # sprawdza jeden plan
  python3 tests/sprawdz_plan.py --self-test             # przykłady + celowo zepsute plany

Format plików: docs/FORMAT-PLANU.md. Reguły R1–R16: docs/SPEC.md, sekcja 16.
Tylko biblioteka standardowa. Kod wyjścia 0 = plan przechodzi.
"""
import copy, json, math, pathlib, sys

DNI = ["pn", "wt", "sr", "czw", "pt", "sob", "nd"]
TYPY = {"wolne", "spokojny", "regeneracyjny", "marszobieg", "dlugi", "akcent", "test", "start"}
MOCNE = {"akcent", "test", "start"}          # dni „mocne”
DLUGI_MAX, DLUGI_SYM_MAX, SYM_MAX = 170, 180, 2
WZROST, WZROST_MIN = 1.10, 15                # tydzień ≤ 110% albo +15 min
LZEJSZY = 0.88                               # lżejszy tydzień ≤ 88% poprzedniego
UDZIAL_MOCNY = 0.25
RIEGEL = 1.06


def sek(t):
    """'h:mm:ss' lub 'mm:ss' -> sekundy"""
    p = [int(x) for x in t.split(":")]
    while len(p) < 3:
        p.insert(0, 0)
    return p[0] * 3600 + p[1] * 60 + p[2]


def prognoza_riegel(rekordy, dystans_km):
    """Najlepsza (najszybsza) prognoza z rekordów; None gdy brak rekordów."""
    w = [sek(r["czas"]) * (dystans_km / r["dystans_km"]) ** RIEGEL for r in rekordy or []]
    return min(w) if w else None


def suma(tydz, bez_startu=False):
    return sum(d["min"] for d in tydz["dni"] if not (bez_startu and d["typ"] == "start"))


def sprawdz(profil, plan):
    """Zwraca listę (reguła, opis). Pusta lista = plan przechodzi."""
    b = []
    tyg = plan.get("tygodnie", [])

    # R1 – format
    for t in tyg:
        if [d.get("dzien") for d in t.get("dni", [])] != DNI:
            b.append(("R1", f"tydz. {t.get('nr')}: musi być 7 dni w kolejności pn…nd"))
            return b
        for d in t["dni"]:
            if d.get("typ") not in TYPY:
                b.append(("R1", f"tydz. {t['nr']} {d['dzien']}: nieznany typ {d.get('typ')!r}"))
                return b
            if not (0 <= d.get("mocne_min", 0) <= d.get("min", -1)):
                b.append(("R1", f"tydz. {t['nr']} {d['dzien']}: mocne_min poza zakresem 0…min"))
                return b
            if (d["typ"] == "wolne") != (d["min"] == 0):
                b.append(("R1", f"tydz. {t['nr']} {d['dzien']}: 'wolne' ⇔ 0 minut biegu"))
    if not tyg:
        return [("R1", "plan nie ma tygodni")]

    poziom = profil["poziom"]
    powrot = profil.get("powrot_po_przerwie", False)
    baza = round(profil["obciazenie"]["h_tydz"] * 60)
    cel = (plan.get("ocena_celu") or {}).get("cel_posredni") or profil["cel"]
    dlugi_cel = cel["typ"] == "dystans" and cel["dystans_km"] >= 21
    plaski = [(t["nr"], d) for t in tyg for d in t["dni"]]

    # R2 – dni zablokowane i limit czasu dnia (start = zawody, bez limitu)
    for nr, d in plaski:
        lim = profil["dni"][d["dzien"]]["max_min"]
        if d["typ"] != "start" and d["min"] > lim:
            b.append(("R2", f"tydz. {nr} {d['dzien']}: {d['min']} min > limit dnia {lim}"))

    # R3 – mocne dni nie pod rząd; długi nie dzień po mocnym; mocny nie dzień po długim
    for (n1, a), (n2, c) in zip(plaski, plaski[1:]):
        para = (a["typ"], c["typ"])
        if a["typ"] in MOCNE and c["typ"] in MOCNE:
            b.append(("R3", f"tydz. {n1}/{n2} {a['dzien']}→{c['dzien']}: dwa mocne dni pod rząd"))
        elif a["typ"] in MOCNE and c["typ"] == "dlugi":
            b.append(("R3", f"tydz. {n2} {c['dzien']}: długi bieg dzień po mocnym"))
        elif a["typ"] == "dlugi" and c["typ"] in MOCNE:
            b.append(("R3", f"tydz. {n2} {c['dzien']}: mocny dzień po długim biegu"))

    # R4 – limit długiego biegu
    sym = 0
    for nr, d in plaski:
        if d["typ"] != "dlugi":
            continue
        if d.get("symulacja"):
            sym += 1
            if d["min"] > DLUGI_SYM_MAX:
                b.append(("R4", f"tydz. {nr}: symulacja {d['min']} min > {DLUGI_SYM_MAX}"))
        elif d["min"] > DLUGI_MAX:
            b.append(("R4", f"tydz. {nr}: długi {d['min']} min > {DLUGI_MAX}"))
    if sym > SYM_MAX:
        b.append(("R4", f"{sym} symulacje startu > {SYM_MAX}"))

    # R5 – wzrost czasu tygodnia
    sumy = [suma(t) for t in tyg]
    sumy5 = sumy[:-1] + [suma(tyg[-1], True)]          # start docelowy w ostatnim tygodniu nie liczy się do wzrostu
    for i, s in enumerate(sumy5):
        ref = max(sumy5[max(0, i - 3):i] + ([baza] if i < 3 else []))
        if s > max(ref * WZROST, ref + WZROST_MIN) + 0.5:
            b.append(("R5", f"tydz. {tyg[i]['nr']}: {s} min, dozwolone {max(ref*WZROST, ref+WZROST_MIN):.0f}"))

    # R6 – lżejszy tydzień w każdych 5 kolejnych
    lz = [i > 0 and sumy[i] <= LZEJSZY * sumy[i - 1] + 0.5 for i in range(len(sumy))]
    for i in range(len(sumy) - 4):
        if not any(lz[i:i + 5]):
            b.append(("R6", f"tydz. {tyg[i]['nr']}–{tyg[i+4]['nr']}: brak lżejszego tygodnia"))

    # R7 – udział mocnych minut (zawody nie liczą się)
    for t, s in zip(tyg, sumy):
        m = sum(d.get("mocne_min", 0) for d in t["dni"] if d["typ"] != "start")
        if s and m > UDZIAL_MOCNY * s + 0.5:
            b.append(("R7", f"tydz. {t['nr']}: {m} mocnych min z {s} (> 25%)"))

    # R8, R9 – początkujący
    if poziom == "zaczynam":
        for t in tyg:
            if sum(d["typ"] == "wolne" for d in t["dni"]) < 2:
                b.append(("R8", f"tydz. {t['nr']}: początkujący potrzebuje ≥ 2 dni wolnych"))
        for nr, d in plaski:
            if nr <= 8 and d["typ"] == "akcent":
                b.append(("R9", f"tydz. {nr} {d['dzien']}: akcent u początkującego w pierwszych 8 tyg."))
        if profil["obciazenie"]["h_tydz"] < 1.5 and not any(d["typ"] == "marszobieg" for d in tyg[0]["dni"]):
            b.append(("R9", "tydz. 1: brak marszobiegu"))

    # R10 – powrót po przerwie/kontuzji
    if powrot:
        for nr, d in plaski:
            if nr <= 2 and d["typ"] in MOCNE:
                b.append(("R10", f"tydz. {nr} {d['dzien']}: mocny dzień w 2 pierwszych tyg. powrotu"))
        if sumy[0] > baza:
            b.append(("R10", f"tydz. 1: {sumy[0]} min > obecne obciążenie {baza}"))

    # R11 – brak zmierzonego tętna → test w pierwszych 4 tygodniach
    if poziom != "zaczynam" and not powrot and not (profil.get("hrmax") and profil.get("lthr")):
        if not any(nr <= 4 and d["typ"] == "test" for nr, d in plaski):
            b.append(("R11", "brak HRmax/LTHR, a w tyg. 1–4 nie ma testu"))

    # R12 – uczciwa ocena celu
    oc = plan.get("ocena_celu") or {}
    if oc.get("status") not in ("realny", "ambitny", "nierealny"):
        b.append(("R12", "brak ocena_celu.status (realny / ambitny / nierealny)"))
    else:
        c0 = profil["cel"]
        pr = prognoza_riegel(profil.get("rekordy"), c0["dystans_km"]) if c0["typ"] == "dystans" and c0.get("czas") else None
        if pr:
            if not oc.get("prognoza"):
                b.append(("R12", "brak ocena_celu.prognoza"))
            q = sek(c0["czas"]) / pr
            if q < 0.93 and (oc["status"] != "nierealny" or not oc.get("cel_posredni")):
                b.append(("R12", f"cel o {100*(1-q):.0f}% szybszy od prognozy: wymagany status 'nierealny' i cel_posredni"))
            elif 0.93 <= q < 0.98 and oc["status"] == "realny":
                b.append(("R12", "cel 2–7% szybszy od prognozy: status co najmniej 'ambitny'"))
            elif q >= 0.98 and oc["status"] == "nierealny":
                b.append(("R12", "cel zgodny z prognozą oznaczony jako 'nierealny'"))

    # R13 – start w ostatnim tygodniu i taper (półmaraton i dłużej)
    if cel["typ"] == "dystans":
        if not any(d["typ"] == "start" for d in tyg[-1]["dni"]):
            b.append(("R13", "ostatni tydzień nie zawiera startu docelowego"))
        szczyt = max(sumy[:-1], default=0)   # szczyt bez tygodnia startu
        if dlugi_cel and len(tyg) >= 8 and suma(tyg[-1], True) > 0.7 * szczyt + 0.5:
            b.append(("R13", f"brak taperu: ostatni tydzień {suma(tyg[-1], True)} min > 70% szczytu {szczyt}"))

    # R14 – bramki decyzyjne
    if dlugi_cel:
        if not plan.get("bramki"):
            b.append(("R14", "brak bramek decyzyjnych"))
        if not any(d["typ"] in ("test", "start") for t in tyg[:-3] for d in t["dni"]):
            b.append(("R14", "brak testu/startu kontrolnego wcześniej niż 3 tyg. przed celem"))

    # R15 – długi bieg co tydzień (półmaraton i dłużej)
    if dlugi_cel and poziom != "zaczynam":
        for t in tyg[:-1]:
            if not any(d["typ"] == "dlugi" or (d["typ"] in ("start", "test") and d["min"] >= 90) for d in t["dni"]):
                b.append(("R15", f"tydz. {t['nr']}: brak długiego biegu"))

    # R16 – uzupełnienia
    z_sila = sum(any("sila" in d.get("dodatki", []) for d in t["dni"]) for t in tyg)
    if z_sila < math.floor(0.75 * len(tyg)):
        b.append(("R16", f"siła tylko w {z_sila} z {len(tyg)} tygodni (< 75%)"))
    for i, (nr, d) in enumerate(plaski):
        if "plyometria" not in d.get("dodatki", []):
            continue
        if i + 1 < len(plaski) and plaski[i + 1][1]["typ"] in MOCNE:
            b.append(("R16", f"tydz. {nr} {d['dzien']}: plyometria dzień przed mocnym dniem"))
        if nr == tyg[-1]["nr"] and cel["typ"] == "dystans":
            b.append(("R16", f"tydz. {nr}: plyometria w tygodniu startu"))
        if poziom == "zaczynam" and nr <= 4:
            b.append(("R16", f"tydz. {nr}: plyometria u początkującego w pierwszych 4 tyg."))
    return b


# ---------- self-test: przykłady muszą przejść, zepsute plany muszą zostać złapane ----------

def _dzien(plan, nr, dz):
    return next(d for t in plan["tygodnie"] if t["nr"] == nr for d in t["dni"] if d["dzien"] == dz)


def _m_r1(p): p["tygodnie"][2]["dni"].pop()
def _m_r2(p): _dzien(p, 3, "pn").update(typ="spokojny", min=30)
def _m_r3(p): _dzien(p, 5, "sr").update(typ="akcent", mocne_min=10)
def _m_r4(p): next(d for d in p["tygodnie"][9]["dni"] if d["typ"] == "dlugi").update(min=190)
def _m_r5(p):
    for d in p["tygodnie"][5]["dni"]: d["min"] = round(d["min"] * 1.4)
def _m_r6(p):
    for i in (3, 7): p["tygodnie"][i]["dni"] = copy.deepcopy(p["tygodnie"][i - 1]["dni"])
def _m_r7(p):
    for d in p["tygodnie"][2]["dni"]: d["mocne_min"] = d["min"]
def _m_r8(p):
    for d in [d for d in p["tygodnie"][1]["dni"] if d["typ"] == "wolne"][:3]: d.update(typ="spokojny", min=10)
def _m_r9a(p): next(d for d in p["tygodnie"][1]["dni"] if d["min"]).update(typ="akcent")
def _m_r9b(p):
    for d in p["tygodnie"][0]["dni"]:
        if d["typ"] == "marszobieg": d["typ"] = "spokojny"
def _m_r10(p): next(d for d in p["tygodnie"][0]["dni"] if d["min"]).update(typ="akcent")
def _m_r11(p):
    for t in p["tygodnie"]:
        for d in t["dni"]:
            if d["typ"] == "test": d.update(typ="spokojny", mocne_min=0)
def _m_r12(p): p["ocena_celu"]["status"] = "realny"
def _m_r13(p):
    for d in p["tygodnie"][-1]["dni"]:
        if d["typ"] != "start": d["min"] *= 4
def _m_r14(p): p["bramki"] = []
def _m_r15(p): next(d for d in p["tygodnie"][4]["dni"] if d["typ"] == "dlugi").update(typ="spokojny")
def _m_r16(p): _dzien(p, 6, "sr").setdefault("dodatki", []).append("plyometria")

MUTACJE = [  # (przykład, oczekiwana reguła, mutacja)
    ("maraton-320", "R1", _m_r1), ("maraton-320", "R2", _m_r2), ("maraton-320", "R3", _m_r3),
    ("maraton-320", "R4", _m_r4), ("maraton-320", "R5", _m_r5), ("maraton-320", "R6", _m_r6),
    ("maraton-320", "R7", _m_r7), ("poczatkujacy-30min", "R8", _m_r8), ("poczatkujacy-30min", "R9", _m_r9a),
    ("poczatkujacy-30min", "R9", _m_r9b), ("powrot-po-kontuzji", "R10", _m_r10), ("brak-hrmax", "R11", _m_r11),
    ("nierealny-cel", "R12", _m_r12), ("maraton-320", "R13", _m_r13), ("maraton-320", "R14", _m_r14),
    ("maraton-320", "R15", _m_r15), ("maraton-320", "R16", _m_r16),
]


def self_test():
    tu = pathlib.Path(__file__).parent
    wczytaj = lambda p: json.loads(p.read_text(encoding="utf-8"))
    profile = {p.stem: wczytaj(p) for p in sorted((tu / "profile").glob("*.json"))}
    plany = {n: wczytaj(tu / "przyklady" / f"{n}.plan.json") for n in profile}
    ok = True
    for n in profile:
        bl = sprawdz(profile[n], plany[n])
        print(f"{'OK  ' if not bl else 'BŁĄD'} przykład {n}" + "".join(f"\n       {r}: {o}" for r, o in bl))
        ok &= not bl
    for n, regula, mut in MUTACJE:
        p = copy.deepcopy(plany[n]); mut(p)
        zlapane = regula in {r for r, _ in sprawdz(profile[n], p)}
        print(f"{'OK  ' if zlapane else 'BŁĄD'} zepsuty {n}: {regula} {'wykryta' if zlapane else 'NIE wykryta'} ({mut.__name__})")
        ok &= zlapane
    assert abs(prognoza_riegel([{"dystans_km": 10, "czas": "0:43:30"}], 42.195) - 12006) < 30
    print("WSZYSTKO OK" if ok else "SĄ BŁĘDY")
    return ok


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        sys.exit(0 if self_test() else 1)
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    prof, pl = (json.loads(pathlib.Path(a).read_text(encoding="utf-8")) for a in sys.argv[1:])
    bledy = sprawdz(prof, pl)
    for r, o in bledy:
        print(f"{r}: {o}")
    print("PLAN OK – wszystkie reguły R1–R16 spełnione" if not bledy else f"{len(bledy)} naruszeń")
    sys.exit(1 if bledy else 0)
