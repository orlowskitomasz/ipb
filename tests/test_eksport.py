#!/usr/bin/env python3
"""Test eksportu (src/eksport.js): kalendarz ICS i trening FIT. Wymaga: node.
Plik FIT jest czytany niezależnym, minimalnym czytnikiem w Pythonie (struktura, sumy kontrolne, kroki).
Uruchom: python3 tests/test_eksport.py [--zapisz KATALOG]   (zapisuje przykładowe pliki do obejrzenia)
"""
import base64, json, pathlib, struct, subprocess, sys

TU = pathlib.Path(__file__).parent
JS = r"""
const fs = require('fs'), path = require('path'), vm = require('vm');
const c = {}; vm.createContext(c);
vm.runInContext(['reguly','prognoza','strefy','plan','eksport'].map((m) => fs.readFileSync(path.join(process.argv[1], '..', 'src', m + '.js'), 'utf8')).join('\n') + '\nthis.Plan = Plan; this.E = Eksport;', c);
const prof = JSON.parse(fs.readFileSync(0, 'utf8'));
const plan = c.Plan.uloz(prof, prof.start_planu);
const dni = plan.tygodnie.flatMap((t) => t.dni.map((d) => ({ nr: t.nr, d })));
const wez = (f) => dni.find(f).d;
const wybor = { akcent: wez((x) => x.d.typ === 'akcent' && x.d.interwaly && x.d.interwaly.n > 1 && x.d.cel_tetno), tempo: wez((x) => x.d.rodzaj === 'cel' && x.d.typ === 'akcent'),
  dlugi: wez((x) => x.d.typ === 'dlugi'), test: wez((x) => x.d.typ === 'test'), start: wez((x) => x.d.typ === 'start') };
const wy = { ics: c.E.ics(plan, '20261110T080000Z'), biegi: dni.filter((x) => x.d.min).length, dni: {} };
for (const [k, d] of Object.entries(wybor)) wy.dni[k] = { d, kroki: c.E.kroki(d), fit: Buffer.from(c.E.fit(c.E.nazwaTreningu(d, '2026-11-17'), c.E.kroki(d), 1794297600)).toString('base64') };
console.log(JSON.stringify(wy));
"""
CRC_T = [0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401, 0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400]

def crc16(b):
    c = 0
    for x in b:
        for p in (x & 0xF, x >> 4):
            t = CRC_T[c & 0xF]; c = ((c >> 4) & 0x0FFF) ^ t ^ CRC_T[p]
    return c

def czytaj_fit(b):
    """Zwraca {numer_globalny: [ {pole: wartość} ]}; sprawdza nagłówek i obie sumy kontrolne."""
    assert b[0] == 14 and b[8:12] == b".FIT", "nagłówek"
    ile = struct.unpack_from("<I", b, 4)[0]
    assert len(b) == 14 + ile + 2, "długość"
    assert crc16(b[:12]) == struct.unpack_from("<H", b, 12)[0], "suma nagłówka"
    assert crc16(b[:-2]) == struct.unpack_from("<H", b, len(b) - 2)[0], "suma pliku"
    p, defs, wy = 14, {}, {}
    while p < 14 + ile:
        h = b[p]; p += 1
        if h & 0x40:
            glob, n = struct.unpack_from("<H", b, p + 2)[0], b[p + 4]; p += 5
            defs[h & 0xF] = (glob, [(b[p + 3 * i], b[p + 3 * i + 1], b[p + 3 * i + 2]) for i in range(n)]); p += 3 * n
            continue
        glob, pola = defs[h & 0xF]; w = {}
        for nr, roz, typ in pola:
            w[nr] = b[p:p + roz].split(b"\0")[0].decode() if typ == 0x07 else int.from_bytes(b[p:p + roz], "little"); p += roz
        wy.setdefault(glob, []).append(w)
    return wy

if __name__ == "__main__":
    wyniki = []
    def sprawdz(nazwa, w, szczegoly=""):
        wyniki.append(bool(w)); print(("OK   " if w else "BŁĄD ") + nazwa + ("" if w else f" – {szczegoly}"))
    prof = (TU / "profile" / "maraton-320.json").read_text(encoding="utf-8")
    r = subprocess.run(["node", "-e", JS, str(TU)], input=prof, capture_output=True, text=True)
    if r.returncode: print(r.stderr); sys.exit(1)
    w = json.loads(r.stdout)

    ics = w["ics"]; linie = ics.split("\r\n")
    sprawdz("ICS: jedno wydarzenie na każdy bieg planu", ics.count("BEGIN:VEVENT") == w["biegi"] == ics.count("END:VEVENT") and linie[0] == "BEGIN:VCALENDAR", (ics.count("BEGIN:VEVENT"), w["biegi"]))
    sprawdz("ICS: linie do 75 bajtów, koniec linii CRLF", all(len(l.encode()) <= 75 for l in linie) and "\n" not in ics.replace("\r\n", ""))
    rozw = ics.replace("\r\n ", "")
    sprawdz("ICS: wydarzenie niesie cel dnia i uzasadnienie", "Cel: tętno" in rozw and "Po co: " in rozw and "Łatwiejszy wariant" in rozw)
    sprawdz("ICS: daty całodniowe, pierwszy bieg we wtorek 17.11.2026", "DTSTART;VALUE=DATE:20261117" in ics and "DTEND;VALUE=DATE:20261118" in ics)

    a = w["dni"]["akcent"]; k = a["kroki"]; f = czytaj_fit(base64.b64decode(a["fit"]))
    sprawdz("kroki akcentu: rozgrzewka, odcinek, przerwa, powtórzenie, schłodzenie", [x.get("rola", "powt") for x in k] == ["rozgrzewka", "praca", "przerwa", "powt", "schlodzenie"] and k[3] == {"powtorz_od": 1, "razy": a["d"]["interwaly"]["n"]}, k)
    kr = f[27]
    sprawdz("FIT: typ pliku trening, sport bieg, liczba kroków zgodna", f[0][0][0] == 5 and f[26][0][4] == 1 and f[26][0][6] == len(k) == len(kr), (f[0], f[26]))
    sprawdz("FIT: rozgrzewka na czas (ms), odcinek z własnym zakresem tętna (+100)", kr[0][1] == 0 and kr[0][2] == k[0]["czas_s"] * 1000 and kr[0][7] == 2
            and kr[1][3] == 1 and kr[1][5] == a["d"]["cel_tetno"]["od"] + 100 and kr[1][6] == a["d"]["cel_tetno"]["do"] + 100, kr[:2])
    sprawdz("FIT: powtórzenie wskazuje krok 1 i liczbę powtórzeń; schłodzenie otwarte", kr[3][1] == 6 and kr[3][2] == 1 and kr[3][4] == a["d"]["interwaly"]["n"] and kr[4][1] == 5 and kr[4][7] == 3, kr[3:])
    sprawdz("FIT: nazwa bez polskich znaków i bez danych osobowych", f[26][0][8] == f"11-17 Akcent {a['d']['min']}min", f[26][0][8])
    t = w["dni"]["tempo"]; ft = czytaj_fit(base64.b64decode(t["fit"]))[27]
    praca = next(x for x in ft if x[7] == 0 and x[1] == 1)
    sprawdz("FIT: odcinki w tempie celu – dystans w cm i prędkość w mm/s (wolniejsza, szybsza)", praca[2] in (100000, 200000) and praca[3] == 0
            and praca[5] == round(1e6 / t["d"]["cel_tempo"]["do"]) < praca[6] == round(1e6 / t["d"]["cel_tempo"]["od"]), praca)
    d = w["dni"]["dlugi"]; fd = czytaj_fit(base64.b64decode(d["fit"]))[27]
    sprawdz("FIT: długi bieg to jeden krok na czas z tętnem „do”", len(fd) == 1 and fd[0][2] == d["d"]["min"] * 60000 and fd[0][6] == d["d"]["cel_tetno"]["do"] + 100 and fd[0][5] < fd[0][6], fd)
    sprawdz("FIT: sprawdzian bez celu (wysiłek maksymalny), start jako krok otwarty", czytaj_fit(base64.b64decode(w["dni"]["test"]["fit"]))[27][1][3] == 2
            and czytaj_fit(base64.b64decode(w["dni"]["start"]["fit"]))[27][0][1] == 5)
    if "--zapisz" in sys.argv:
        kat = pathlib.Path(sys.argv[sys.argv.index("--zapisz") + 1]); kat.mkdir(parents=True, exist_ok=True)
        (kat / "plan.ics").write_text(ics, encoding="utf-8", newline="")
        for n, x in w["dni"].items(): (kat / f"{n}.fit").write_bytes(base64.b64decode(x["fit"]))
    print("WSZYSTKO OK" if all(wyniki) else "SĄ BŁĘDY"); sys.exit(0 if all(wyniki) else 1)
