#!/usr/bin/env python3
"""Sprawdza generator planu z aplikacji (src/plan.js) regułami walidatora.

5 biegaczy testowych + losowe profile (stałe ziarno). Wymaga: node.
Uruchom: python3 tests/test_plan.py [ile_losowych] [--zapisz]
"""
import json, pathlib, random, subprocess, sys
from collections import Counter
from sprawdz_plan import istotne, DNI

TU = pathlib.Path(__file__).parent

def uloz(profile):
    wej = "\n".join(json.dumps(p, ensure_ascii=False) for p in profile)
    wyj = subprocess.run(["node", str(TU / "plan_node.js")], input=wej, capture_output=True, text=True, check=True).stdout
    return [json.loads(l) for l in wyj.splitlines()]

def losowy(r, i):
    poziom = r.choice(["zaczynam", "regularnie", "regularnie", "zaawansowany"])
    biegowe = r.sample(DNI, r.randint(3, 7))
    dni = {d: {"max_min": r.choice([30, 45, 60, 75, 90, 120, 150, 180, 240]) if d in biegowe else 0} for d in DNI}
    h = round(r.uniform(0.5, 2.5) if poziom == "zaczynam" else r.uniform(1.5, 9), 1)
    tyg = r.randint(8, 30)
    dzien = r.randint(0, 6)
    data_celu = f"D+{(tyg - 1) * 7 + dzien}"
    if poziom == "zaczynam" and r.random() < 0.6:
        cel = {"typ": "czas_biegu", "minuty": r.choice([20, 30, 45, 60])}
    else:
        km = r.choice([5, 10] if poziom == "zaczynam" else [5, 10, 21.0975, 42.195])
        tempo = r.uniform(3.6, 7.5) * 60 * km                      # sekundy; bywa nierealne względem rekordu
        cel = {"typ": "dystans", "dystans_km": km, "czas": None if r.random() < 0.15 else
               f"{int(tempo // 3600)}:{int(tempo // 60 % 60):02d}:{int(tempo % 60):02d}"}
    rek = []
    if r.random() < 0.8:
        km = r.choice([5, 10, 21.0975]); t = r.uniform(3.7, 7.5) * 60 * km
        rek = [{"dystans_km": km, "czas": f"{int(t // 3600)}:{int(t // 60 % 60):02d}:{int(t % 60):02d}", "data": "2026-09-01"}]
    zna = r.random() < 0.5
    return {"id": f"los-{i}", "rok_urodzenia": r.randint(1950, 2008), "plec": r.choice(["k", "m", ""]), "poziom": poziom,
            "powrot_po_przerwie": r.random() < 0.2, "obciazenie": {"h_tydz": h, "km_tydz": round(h * 9), "najdluzszy_min": 60},
            "dni": dni, "rekordy": rek, "hrmax": 185 if zna else None, "lthr": 168 if zna else None,
            "start_planu": "2026-11-16", "cel": cel, "_offset": (tyg - 1) * 7 + dzien}

if __name__ == "__main__":
    import datetime
    liczby = [a for a in sys.argv[1:] if a.isdigit()]
    ile = int(liczby[0]) if liczby else 500
    stale = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((TU / "profile").glob("*.json"))]
    r = random.Random(20261110)
    losowe = [losowy(r, i) for i in range(ile)]
    for p in losowe:
        p["cel"]["data"] = str(datetime.date(2026, 11, 16) + datetime.timedelta(days=p.pop("_offset")))
    if "--zapisz" in sys.argv:        # odśwież tests/przyklady/ planami z generatora aplikacji
        for prof, plan in zip(stale, uloz(stale)):
            plan.pop("_ustalenia")
            (TU / "przyklady" / f"{prof['id']}.plan.json").write_text(json.dumps({"profil": prof["id"], **plan}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    ok, licznik = True, Counter()
    for prof, plan in zip(stale + losowe, uloz(stale + losowe)):
        # plan prosto z generatora nie może mieć ustaleń powyżej poziomu informacji; z informacji tylko R19 (dzień wolny) i R20 (stary wynik)
        wszystkie = plan.pop("_ustalenia")
        bl = istotne(wszystkie) + [(u["id"], u["opis"]) for u in wszystkie if u["poziom"] == "informacja" and u["id"] not in ("R19", "R20", "R22")]
        if prof in stale:
            print(f"{'OK  ' if not bl else 'BŁĄD'} generator: {prof['id']} ({len(plan['tygodnie'])} tyg., szczyt {max(sum(d['min'] for d in t['dni']) for t in plan['tygodnie'])} min)")
        if bl:
            ok = False
            licznik.update(r for r, _ in bl)
            if sum(licznik.values()) <= 12 or prof in stale:
                print(f"     {prof['id']}: " + "; ".join(f"{r}: {o}" for r, o in bl[:3]))
    print(f"{'OK  ' if not licznik else 'BŁĄD'} generator: {ile} losowych profili" + (f" – naruszenia: {dict(licznik)}" if licznik else ""))

    # ręczne zmiany muszą dać właściwe ostrzeżenie lub podpowiedź (plan maratoński: wt i czw mocne, nd długi, pn wolny)
    prof = next(p for p in stale if p["id"] == "maraton-320")
    plan = lambda: json.loads((TU / "przyklady" / "maraton-320.plan.json").read_text(encoding="utf-8"))
    przypadki = [
        ("zamiana wt↔śr → dwa mocne dni pod rząd", [{"tydzien": 5, "typ": "zamiana", "a": "wt", "b": "sr"}], "Dwa mocne dni pod rząd"),
        ("zamiana czw↔sob → długi dzień po mocnym", [{"tydzien": 5, "typ": "zamiana", "a": "czw", "b": "sob"}], "Długi bieg dzień po mocnym"),
        ("zamiana nd↔śr → mocny dzień po długim", [{"tydzien": 5, "typ": "zamiana", "a": "nd", "b": "sr"}], "Mocny trening dzień po długim"),
        ("zamiana wt↔pn → bieg w dniu wolnym z wywiadu", [{"tydzien": 5, "typ": "zamiana", "a": "wt", "b": "pn"}], "w wywiadzie jest wolny"),
        ("odpuszczony długi bieg → podpowiedź", [{"tydzien": 5, "typ": "odpusc", "a": "nd"}], "nie ma długiego biegu"),
        ("odpuszczone dni z siłą → podpowiedź", [{"tydzien": 5, "typ": "odpusc", "a": "sr"}, {"tydzien": 5, "typ": "odpusc", "a": "pt"}], "nie ma ćwiczeń siłowych"),
        ("zmiany w innym tygodniu nie ruszają tygodnia 5", [{"tydzien": 6, "typ": "zamiana", "a": "wt", "b": "sr"}], None),
    ]
    wej = "\n".join(json.dumps({"profil": prof, "plan": plan(), "zmiany": z}, ensure_ascii=False) for _, z, _ in przypadki)
    wyj = subprocess.run(["node", str(TU / "plan_node.js")], input=wej, capture_output=True, text=True, check=True).stdout.splitlines()
    for (nazwa, _, oczek), linia in zip(przypadki, wyj):
        w5 = [x["opis"] for x in json.loads(linia) if x["tydzien"] == 5]
        dobrze = any(oczek in t for t in w5) if oczek else not w5
        ok &= dobrze
        print(f"{'OK  ' if dobrze else 'BŁĄD'} podpowiedzi: {nazwa}" + ("" if dobrze else f" – jest: {w5}"))
    print("WSZYSTKO OK" if ok else "SĄ BŁĘDY")
    sys.exit(0 if ok else 1)
