#!/usr/bin/env python3
"""Sprawdza plan IPB (plan.json) względem profilu biegacza (profil.json).

Reguły żyją w jednym miejscu: src/walidator.js (opis i źródła: src/reguly.js). Ten plik tylko uruchamia
walidator przez node i sprawdza go na celowo zepsutych planach.

Użycie:
  python3 tests/sprawdz_plan.py PROFIL.json PLAN.json   # pełne ustalenia dla jednego planu
  python3 tests/sprawdz_plan.py --self-test             # przykłady + celowo zepsute plany

Format plików: docs/FORMAT-PLANU.md. Reguły R1–R20: docs/SPEC.md, sekcja 16. Wymaga: node.
Kod wyjścia 0 = brak ustaleń na poziomie uwagi lub wyższym.
"""
import copy, json, pathlib, subprocess, sys

TU = pathlib.Path(__file__).parent
DNI = ["pn", "wt", "sr", "czw", "pt", "sob", "nd"]


def ustalenia_wiele(pary):
    """[(profil, plan), …] → lista list pełnych ustaleń walidatora (jedno wywołanie node dla wszystkich)."""
    wej = "\n".join(json.dumps({"profil": p, "plan": pl, "zmiany": []}, ensure_ascii=False) for p, pl in pary)
    wyj = subprocess.run(["node", str(TU / "plan_node.js")], input=wej, capture_output=True, text=True, check=True).stdout
    return [json.loads(l) for l in wyj.splitlines()]


def istotne(ustalenia):
    """Ustalenia, które plan z generatora musi mieć puste: wszystko powyżej poziomu „informacja”."""
    return [(u["id"], u["opis"]) for u in ustalenia if u["poziom"] != "informacja"]


def sprawdz(profil, plan):
    """Zwraca listę (reguła, opis) dla ustaleń powyżej poziomu informacji. Pusta lista = plan przechodzi."""
    return istotne(ustalenia_wiele([(profil, plan)])[0])


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
def _m_r17(p): _dzien(p, 5, "nd").pop("cel_tetno", None); _dzien(p, 5, "nd").pop("cel_tempo", None)
def _m_r21(p): _dzien(p, 5, "nd").pop("po_co", None)

MUTACJE = [  # (przykład, oczekiwana reguła, mutacja)
    ("maraton-320", "R1", _m_r1), ("maraton-320", "R2", _m_r2), ("maraton-320", "R3", _m_r3),
    ("maraton-320", "R4", _m_r4), ("maraton-320", "R5", _m_r5), ("maraton-320", "R6", _m_r6),
    ("maraton-320", "R7", _m_r7), ("poczatkujacy-30min", "R8", _m_r8), ("poczatkujacy-30min", "R9", _m_r9a),
    ("poczatkujacy-30min", "R9", _m_r9b), ("powrot-po-kontuzji", "R10", _m_r10), ("brak-hrmax", "R11", _m_r11),
    ("nierealny-cel", "R12", _m_r12), ("maraton-320", "R13", _m_r13), ("maraton-320", "R14", _m_r14),
    ("maraton-320", "R15", _m_r15), ("maraton-320", "R16", _m_r16), ("maraton-320", "R17", _m_r17), ("maraton-320", "R21", _m_r21),
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
    print("WSZYSTKO OK" if ok else "SĄ BŁĘDY")
    return ok


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        sys.exit(0 if self_test() else 1)
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    prof, pl = (json.loads(pathlib.Path(a).read_text(encoding="utf-8")) for a in sys.argv[1:])
    wszystkie = ustalenia_wiele([(prof, pl)])[0]
    for u in wszystkie:
        gdzie = f"tydz. {u['tydzien']}: " if u["tydzien"] else ""
        print(f"[{u['poziom']}] {u['id']} {u['nazwa']} – {gdzie}{u['opis']}")
        print(f"      dlaczego: {u['uzasadnienie']}")
        print(f"      źródło (klasa {u['klasa']}, pewność {u['pewnosc']}): {u['zrodlo']}")
        print(f"      korekta: {u['korekta']}")
    wazne = istotne(wszystkie)
    print("PLAN OK – brak ustaleń powyżej poziomu informacji" if not wazne else f"{len(wazne)} ustaleń do rozważenia (plus {len(wszystkie) - len(wazne)} informacji)")
    sys.exit(1 if wazne else 0)
