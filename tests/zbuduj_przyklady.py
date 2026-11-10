#!/usr/bin/env python3
"""Buduje przykładowe plany (tests/przyklady/*.plan.json) z profili testowych.

To NIE jest silnik planu IPB – tylko prosty, jawny sposób na odtworzenie przykładów,
na których sprawdzany jest tests/sprawdz_plan.py. Uruchom: python3 tests/zbuduj_przyklady.py
"""
import datetime, json, pathlib

TU = pathlib.Path(__file__).parent
DNI = ["pn", "wt", "sr", "czw", "pt", "sob", "nd"]

# Na profil: minuty biegu w kolejnych tygodniach (ostatni = tydzień startu, liczony osobno),
# role dni, udział długiego biegu, tygodnie z testem (czwartek) i dodatki.
SZABLONY = {
    "poczatkujacy-30min": dict(
        minuty=[60, 72, 84, 72, 90, 102, 114, 96, 120],
        role={"wt": "marszobieg", "pt": "marszobieg", "nd": "marszobieg"}, bieg_ciagly_od=8,
        final={"wt": ("spokojny", 20, 0), "pt": ("spokojny", 20, 0), "nd": ("spokojny", 30, 0)},
        sila="pt", ocena=dict(status="realny", uzasadnienie="Cel na czas biegu, progresja marszobiegu przez 10 tygodni."),
        bramki=[dict(tydzien=5, opis="15 min biegu ciągłego bez zadyszki", prog="jeśli nie – powtórz tydzień 4–5")]),
    "maraton-320": dict(
        minuty=[330, 355, 380, 330, 400, 430, 455, 395, 470, 485, 485, 420, 485, 485, 485, 425, 485, 485, 400, 330],
        role={"wt": "akcent", "sr": "spokojny", "czw": "akcent", "pt": "regeneracyjny", "sob": "spokojny", "nd": "dlugi"},
        dlugi=0.34, akcent=0.14, testy={3: "test 30 min (LTHR)", 8: "test 10 km"}, polmaraton=16, symulacje=[14, 17],
        final={"wt": ("akcent", 45, 12), "czw": ("spokojny", 40, 0), "sob": ("regeneracyjny", 20, 0), "nd": ("start", 200, 200)},
        sila="sr", sila2="sob", plyo="wt",
        ocena=dict(status="ambitny", prognoza="3:20:06", uzasadnienie="Riegel z 10 km 43:30 daje ok. 3:20 – cel na granicy prognozy."),
        bramki=[dict(tydzien=3, opis="test 30 min", prog="tempo progu ≤ 4:25/km"),
                dict(tydzien=8, opis="10 km", prog="≤ 43:00 – cel zostaje; > 44:30 – cel 3:25"),
                dict(tydzien=16, opis="półmaraton kontrolny", prog="≤ 1:35:30 – cel zostaje; > 1:38 – cel 3:25–3:30")]),
    "nierealny-cel": dict(
        minuty=[180, 195, 210, 180, 225, 245, 265, 230, 285, 305, 320, 280, 320, 320, 270],
        role={"wt": "akcent", "czw": "spokojny", "sob": "spokojny", "nd": "dlugi"},
        dlugi=0.42, akcent=0.16, testy={5: "test 5 km", 10: "test 10 km"},
        final={"wt": ("akcent", 40, 10), "czw": ("spokojny", 35, 0), "sob": ("regeneracyjny", 20, 0), "nd": ("start", 250, 250)},
        sila="czw", plyo="wt",
        ocena=dict(status="nierealny", prognoza="4:13:00",
                   uzasadnienie="10 km w 55:00 odpowiada maratonowi ok. 4:13. Cel 3:15 jest o 23% szybszy – nieosiągalny w 16 tygodni.",
                   cel_posredni={"typ": "dystans", "dystans_km": 42.195, "czas": "4:10:00", "data": "2027-03-07"}),
        bramki=[dict(tydzien=5, opis="5 km", prog="≤ 26:00 – plan zostaje"),
                dict(tydzien=10, opis="10 km", prog="≤ 53:30 – cel 4:05–4:10; > 55:00 – cel: ukończyć")]),
    "powrot-po-kontuzji": dict(
        minuty=[115, 130, 145, 125, 160, 175, 190, 165, 205, 220, 190],
        role={"wt": "akcent", "czw": "spokojny", "sob": "spokojny", "nd": "dlugi"},
        dlugi=0.33, akcent=0.24, bez_mocnych_do=2, testy={},
        final={"wt": ("akcent", 40, 10), "czw": ("spokojny", 35, 0), "sob": ("regeneracyjny", 25, 0), "nd": ("start", 40, 40)},
        sila="czw", plyo=None,
        ocena=dict(status="realny", prognoza="0:39:00", uzasadnienie="Rekord 39:00 sprzed przerwy; 40:00 realne po spokojnym powrocie."),
        bramki=[dict(tydzien=6, opis="3 × 2 km w tempie celu bez bólu", prog="ból → tydzień bez akcentów")]),
    "brak-hrmax": dict(
        minuty=[150, 165, 180, 158, 195, 214, 235, 205, 255, 280, 280, 245, 200],
        role={"wt": "akcent", "sr": "spokojny", "czw": "spokojny", "sob": "spokojny", "nd": "dlugi"},
        dlugi=0.38, akcent=0.2, testy={2: "test 30 min (wyznaczenie LTHR i HRmax)", 9: "test 10 km"},
        final={"wt": ("akcent", 40, 10), "czw": ("spokojny", 35, 0), "sob": ("regeneracyjny", 20, 0), "nd": ("start", 120, 120)},
        sila="sr", plyo="wt",
        ocena=dict(status="ambitny", prognoza="2:01:54", uzasadnienie="Riegel z 5 km 26:30 daje ok. 2:02 – cel 1:59 jest 2% szybszy."),
        bramki=[dict(tydzien=2, opis="test 30 min", prog="wyznacza strefy – bez niego strefy są szacunkiem"),
                dict(tydzien=9, opis="10 km", prog="≤ 55:00 – cel zostaje; > 56:30 – cel 2:03")]),
}


def tydzien(prof, sz, nr, T, ostatni):
    dni = {d: dict(dzien=d, typ="wolne", min=0, mocne_min=0, dodatki=[]) for d in DNI}
    if ostatni:
        for d, (typ, m, mocne) in sz["final"].items():
            dni[d].update(typ=typ, min=m, mocne_min=mocne)
    else:
        role = dict(sz["role"])
        lim = {d: prof["dni"][d]["max_min"] for d in DNI}
        if nr <= sz.get("bez_mocnych_do", 0):
            role = {d: ("spokojny" if r == "akcent" else r) for d, r in role.items()}
        if nr in sz.get("testy", {}):
            role["czw"] = "test"
        if sz.get("polmaraton") == nr:
            role["nd"] = "start"
        if nr >= sz.get("bieg_ciagly_od", 99):
            role = {d: "spokojny" for d in role}
        reszta = T
        for d, r in role.items():
            if r == "dlugi":
                sym = nr in sz.get("symulacje", [])
                m = 175 if sym else min(170, lim[d], round(sz["dlugi"] * T))
                dni[d].update(typ="dlugi", min=m, **({"symulacja": True} if sym else {}))
            elif r == "start":
                dni[d].update(typ="start", min=100, mocne_min=100, opis="półmaraton kontrolny")
            elif r in ("akcent", "test"):
                m = min(lim[d], round(sz["akcent"] * T))
                dni[d].update(typ=r, min=m, mocne_min=round(0.4 * m))
                if r == "test":
                    dni[d]["opis"] = sz["testy"][nr]
            else:
                continue
            reszta -= dni[d]["min"]
        lekkie = [d for d, r in role.items() if dni[d]["typ"] == "wolne"]
        pula = sum(lim[d] for d in lekkie)
        for i, d in enumerate(lekkie):  # reszta proporcjonalnie do limitów dni
            m = min(lim[d], round(reszta * lim[d] / pula)) if i < len(lekkie) - 1 else min(lim[d], reszta - sum(dni[x]["min"] for x in lekkie))
            if m > 0:
                dni[d].update(typ=role[d], min=m)
        if sz.get("plyo") and dni[sz["plyo"]]["min"] and (nr > 4 or prof["poziom"] != "zaczynam"):
            dni[sz["plyo"]]["dodatki"].append("plyometria")
    for k in ("sila", "sila2"):
        if sz.get(k) and not ostatni:
            dni[sz[k]]["dodatki"].append("sila")
    for d in dni.values():
        if d["typ"] in ("akcent", "test"):
            d["dodatki"].insert(0, "rozgrzewka")
        if d["min"]:
            d["dodatki"].append("mobilnosc")
    return [dni[d] for d in DNI]


def faza(i, n):
    return "taper" if i >= n - 2 else "baza" if i < 0.4 * n else "rozwoj" if i < 0.7 * n else "specyficzna"


for plik in sorted((TU / "profile").glob("*.json")):
    prof = json.loads(plik.read_text(encoding="utf-8"))
    sz = SZABLONY[prof["id"]]
    start = datetime.date.fromisoformat(prof["start_planu"])
    minuty = sz["minuty"] + [None]
    plan = dict(profil=prof["id"], ocena_celu=sz["ocena"], bramki=sz["bramki"], tygodnie=[
        dict(nr=i + 1, start=str(start + datetime.timedelta(weeks=i)), faza=faza(i, len(minuty)),
             dni=tydzien(prof, sz, i + 1, T, T is None)) for i, T in enumerate(minuty)])
    assert str(start + datetime.timedelta(weeks=len(minuty) - 1, days=6)) == prof["cel"]["data"], prof["id"]
    (TU / "przyklady" / f"{prof['id']}.plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(prof["id"], [sum(d["min"] for d in t["dni"]) for t in plan["tygodnie"]])
