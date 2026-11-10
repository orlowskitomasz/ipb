#!/usr/bin/env python3
"""Testy silnika: rejestr reguł, VDOT i prognoza jako przedział, status danych. Wymaga: node.
Uruchom: python3 tests/test_silnik.py
"""
import json, pathlib, re, subprocess, sys

TU = pathlib.Path(__file__).parent
SRC = TU.parent / "src"
JS = r"""
const fs = require('fs'), path = require('path'), vm = require('vm');
const c = {}; vm.createContext(c);
vm.runInContext(['reguly','prognoza','strefy'].map((m) => fs.readFileSync(path.join(process.argv[1], m + '.js'), 'utf8')).join('\n') + '\nthis.R = REGULY; this.P = Prognoza; this.S = Strefy;', c);
const we = JSON.parse(fs.readFileSync(0, 'utf8'));
console.log(JSON.stringify({
  reguly: c.R,
  vdot: we.vdot.map(([km, t]) => c.P.vdot(km, c.P.sek(t))),
  odwrotnie: we.vdot.map(([km, t]) => c.P.czasVdot(c.P.vdot(km, c.P.sek(t)), km) - c.P.sek(t)),
  oceny: we.oceny.map(([p, d]) => c.P.ocena(p, d)),
  statusy: we.statusy.map(([r, d]) => c.P.statusWyniku(r, d)),
  tempa: c.S.licz(we.oceny[0][0], 2026).tempa,
}));
"""

if __name__ == "__main__":
    wyniki = []
    def sprawdz(nazwa, w, szczegoly=""):
        wyniki.append(bool(w)); print(("OK   " if w else "BŁĄD ") + nazwa + ("" if w else f" – {szczegoly}"))
    # wartości z opublikowanych tabel VDOT (dystans, czas) → VDOT
    tabela = [(5, "0:19:57", 50), (10, "0:41:21", 50), (21.0975, "1:31:35", 50), (42.195, "3:10:49", 50), (5, "0:24:08", 40), (10, "0:50:03", 40), (42.195, "3:49:45", 40)]
    prof = lambda cel_czas, rek, data="2026-10-04": {"cel": {"typ": "dystans", "dystans_km": 21.0975, "czas": cel_czas},
                                                     "rekordy": [{"dystans_km": 10, "czas": rek, "data": data}], "rok_urodzenia": 1988, "hrmax": None, "lthr": None}
    oceny = [(prof("1:55:00", "0:52:30"), "2026-11-10"), (prof("1:53:00", "0:52:30"), "2026-11-10"), (prof("1:40:00", "0:52:30"), "2026-11-10"),
             (prof("1:55:00", "0:52:30", "2025-11-01"), "2026-11-10"), ({"cel": {"typ": "czas_biegu", "minuty": 30}, "rekordy": []}, "2026-11-10")]
    statusy = [(None, "2026-11-10"), ({"data": "2026-10-01"}, "2026-11-10"), ({"data": "2026-04-01"}, "2026-11-10"), ({"data": None}, "2026-11-10")]
    r = subprocess.run(["node", "-e", JS, str(SRC)], input=json.dumps({"vdot": [t[:2] for t in tabela], "oceny": oceny, "statusy": statusy}), capture_output=True, text=True)
    if r.returncode: print(r.stderr); sys.exit(1)
    w = json.loads(r.stdout)

    wal = (SRC / "walidator.js").read_text(encoding="utf-8")
    uzyte = set(re.findall(r"dodaj\('(R\d+)'", wal))
    sprawdz("każda reguła walidatora ma wpis w rejestrze i odwrotnie", uzyte == set(w["reguly"]), sorted(uzyte ^ set(w["reguly"])))
    pola = {"nazwa", "poziom", "klasa", "pewnosc", "zrodlo", "potwierdzone", "uzasadnienie", "korekta"}
    sprawdz("każdy wpis ma komplet pól, znaną klasę, poziom i pewność", all(pola <= set(x) and x["klasa"] in "ABCD" and x["poziom"] in ("krytyczne", "zastrzezenie", "uwaga", "informacja")
            and x["pewnosc"] in ("niska", "srednia", "wysoka") for x in w["reguly"].values()))
    sprawdz("rejestr nie zawiera numerów DOI ani adresów (źródła niepotwierdzone są oznaczone)", not re.search(r"doi|10\.\d{4}/|https?://", json.dumps(w["reguly"]), re.I)
            and any(not x["potwierdzone"] for x in w["reguly"].values()))
    sprawdz("krytyczne są tylko format i twarde ograniczenia zawodnika", {k for k, x in w["reguly"].items() if x["poziom"] == "krytyczne"} == {"R1", "R2"})
    sprawdz("VDOT zgodny z tabelami (7 par wynik → VDOT, do 0,15)", all(abs(v - t[2]) < 0.15 for v, t in zip(w["vdot"], tabela)), [round(v, 2) for v in w["vdot"]])
    sprawdz("czas z VDOT odwraca się do sekundy", all(abs(x) < 1 for x in w["odwrotnie"]), w["odwrotnie"])
    o = w["oceny"]
    sprawdz("prognoza to przedział z dwóch metod", "–" in o[0]["prognoza"] and o[0]["metody"] == ["Riegel", "VDOT (Daniels–Gilbert)"] and o[0]["prognoza_od"] < o[0]["prognoza_do"], o[0])
    sprawdz("cel w prognozie = realny; 2–7% szybszy = ambitny; ponad 7% = nierealny z celem pośrednim",
            [x["status"] for x in o[:3]] == ["realny", "ambitny", "nierealny"] and o[2].get("cel_posredni"), [x["status"] for x in o[:3]])
    sprawdz("stary wynik obniża pewność prognozy i jest to powiedziane", o[0]["pewnosc"] == "srednia" and o[3]["pewnosc"] == "niska" and "6 miesięcy" in " ".join(o[3]["zastrzezenia"]), o[3])
    sprawdz("bez wyniku nie ma prognozy (nic nie jest zmyślane)", o[4]["prognoza"] is None and o[4]["pewnosc"] == "niska")
    sprawdz("status wyniku: brak, aktualny, nieaktualny, bez daty", w["statusy"] == ["brak", "aktualny", "nieaktualny", "bez daty"], w["statusy"])
    t = w["tempa"]
    sprawdz("tempa z VDOT: szybszy koniec przed wolniejszym i I < T < M < E", all(t[k][0] < t[k][1] for k in "EMTI") and t["I"][1] < t["T"][1] < t["M"][1] < t["E"][1], t)
    print("WSZYSTKO OK" if all(wyniki) else "SĄ BŁĘDY"); sys.exit(0 if all(wyniki) else 1)
