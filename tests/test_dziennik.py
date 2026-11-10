#!/usr/bin/env python3
"""Test dziennika (src/dziennik.js): pliki FIT/TCX/GPX zbudowane w teście, ocena biegu, obciążenie. Wymaga: node.
Uruchom: python3 tests/test_dziennik.py [prawdziwy_plik.fit ...]   (prawdziwych plików nie trzymamy w repozytorium)
"""
import base64, json, pathlib, struct, subprocess, sys

TU = pathlib.Path(__file__).parent
FIT_EPOKA = 631065600
START = 1794297600            # 2026-11-10 08:00:00 UTC

def fit(sekundy=3600, hr=lambda t: 150, mps=3.0, krok=5, dev=False):
    """Minimalny plik FIT: definicja rekordu (czas, tętno, dystans) + rekordy + sesja."""
    cialo = b""
    # definicja lokalna 0 → rekord (20): pola 253 uint32, 3 uint8, 5 uint32; opcjonalnie pole deweloperskie (1 bajt)
    cialo += bytes([0x40 | (0x20 if dev else 0), 0, 0]) + struct.pack("<H", 20) + bytes([3, 253, 4, 0x86, 3, 1, 0x02, 5, 4, 0x86])
    if dev: cialo += bytes([1, 0, 1, 0])
    t0 = START - FIT_EPOKA
    for t in range(0, sekundy + 1, krok):
        cialo += bytes([0x00]) + struct.pack("<IBI", t0 + t, hr(t), int(t * mps * 100)) + (b"\x07" if dev else b"")
    # definicja lokalna 1 → sesja (18): start(2), czas(8, ms), dystans(9, cm), śr. tętno(16), maks. tętno(17)
    cialo += bytes([0x41, 0, 0]) + struct.pack("<H", 18) + bytes([5, 2, 4, 0x86, 8, 4, 0x86, 9, 4, 0x86, 16, 1, 0x02, 17, 1, 0x02])
    hrs = [hr(t) for t in range(0, sekundy + 1, krok)]
    cialo += bytes([0x01]) + struct.pack("<IIIBB", t0, sekundy * 1000, int(sekundy * mps * 100), round(sum(hrs) / len(hrs)), max(hrs))
    return bytes([14, 0x20]) + struct.pack("<HI", 2100, len(cialo)) + b".FIT" + b"\x00\x00" + cialo + b"\x00\x00"

def iso(t): 
    import datetime
    return datetime.datetime.fromtimestamp(START + t, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def tcx(sekundy=1800):
    p = "".join(f"<Trackpoint><Time>{iso(t)}</Time><DistanceMeters>{t * 2.5:.1f}</DistanceMeters><HeartRateBpm><Value>{140 + (t > 900) * 30}</Value></HeartRateBpm></Trackpoint>" for t in range(0, sekundy + 1, 5))
    return f'<?xml version="1.0"?><TrainingCenterDatabase><Activities><Activity Sport="Running"><Lap><Track>{p}</Track></Lap></Activity></Activities></TrainingCenterDatabase>'.encode()

def gpx(sekundy=1200):
    # 1 stopień szerokości ≈ 111,195 km; 3 m/s na północ
    p = "".join(f'<trkpt lat="{52 + t * 3 / 111195:.7f}" lon="21.0000000"><ele>100</ele><time>{iso(t)}</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>145</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>' for t in range(0, sekundy + 1, 5))
    return f'<?xml version="1.0"?><gpx version="1.1"><trk><trkseg>{p}</trkseg></trk></gpx>'.encode()

JS = r"""
const fs = require('fs'), path = require('path'), vm = require('vm');
const c = { TextDecoder, console }; vm.createContext(c);
vm.runInContext(['prognoza','strefy','dziennik'].map((m) => fs.readFileSync(path.join(process.argv[1], '..', 'src', m + '.js'), 'utf8')).join('\n') + '\nthis.D = Dziennik;', c);
const we = JSON.parse(fs.readFileSync(0, 'utf8')), wy = {};
for (const [n, b] of Object.entries(we.pliki)) { try { wy[n] = c.D.zamknij(c.D.zPliku(n, Uint8Array.from(Buffer.from(b, 'base64')).buffer), we.lthr); } catch (e) { wy[n] = { blad: e.message }; } }
wy.oceny = we.oceny.map(([w, d]) => c.D.ocena(w, d));
wy.wsk = we.wsk.map(([dz, dzis]) => c.D.wskazniki(dz, we.lthr, dzis));
console.log(JSON.stringify(wy));
"""

if __name__ == "__main__":
    wyniki = []
    def sprawdz(nazwa, w, szczegoly=""):
        wyniki.append(bool(w)); print(("OK   " if w else "BŁĄD ") + nazwa + ("" if w else f" – {szczegoly}"))
    interwaly = lambda t: 175 if 900 <= t < 2100 else 140          # 20 min powyżej progu w środku
    pliki = {"rowny.fit": fit(), "interwaly.fit": fit(hr=interwaly), "dev.fit": fit(dev=True), "bieg.tcx": tcx(), "bieg.gpx": gpx(),
             "zly.fit": b"to nie jest fit, tylko tekst", "trasa.gpx": b'<gpx><trk><trkseg><trkpt lat="52" lon="21"></trkpt></trkseg></trk></gpx>'}
    prawdziwe = [pathlib.Path(a) for a in sys.argv[1:]]
    for p in prawdziwe: pliki["PRAWDZIWY:" + p.name.replace(".fit", "") + ".fit"] = p.read_bytes()
    spok = {"typ": "spokojny", "min": 60, "mocne_min": 0, "cel_tetno": {"do": 150}}
    akc = {"typ": "akcent", "min": 60, "mocne_min": 20, "cel_tetno": {"od": 160, "do": 168}}
    oceny = [({"min": 60, "hr_sr": 145}, spok), ({"min": 60, "hr_sr": 160}, spok), ({"min": 30, "hr_sr": 145}, spok),
             ({"min": 60, "mocne_min": 20}, akc), ({"min": 60, "mocne_min": 5}, akc), ({"min": 45}, spok),
             ({"min": 40, "hr_sr": 150}, {"typ": "wolne", "min": 0}), ({"min": 60, "odczucie": 8}, spok)]
    import datetime
    dni = lambda n, od=0: [str(datetime.date(2026, 11, 10) - datetime.timedelta(days=i)) for i in range(od, n)]
    rowno = [{"data": d, "min": 50, "hr_sr": 145} for d in dni(35)][::2]
    skok = rowno[:] + [{"data": d, "min": 90, "hr_sr": 165} for d in dni(7)]
    przerwa = [w for w in rowno if w["data"] < dni(8)[-1]]
    wsk = [([], "2026-11-10"), (rowno[:3], "2026-11-10"), (rowno, "2026-11-10"), (skok, "2026-11-10"), (przerwa, "2026-11-10")]
    wej = json.dumps({"lthr": 170, "pliki": {n: base64.b64encode(b).decode() for n, b in pliki.items()}, "oceny": oceny, "wsk": wsk})
    r = subprocess.run(["node", "-e", JS, str(TU)], input=wej, capture_output=True, text=True, env={"TZ": "UTC", "PATH": __import__("os").environ["PATH"]})
    if r.returncode: print(r.stderr); sys.exit(1)
    w = json.loads(r.stdout)

    f = w["rowny.fit"]
    sprawdz("FIT: data, czas, dystans, tętno", f == {"data": "2026-11-10", "zrodlo": "fit", "min": 60, "km": 10.8, "hr_sr": 150, "hr_max": 150, "mocne_min": 0}, f)
    sprawdz("FIT: mocne minuty z przebiegu tętna (20 min powyżej progu)", w["interwaly.fit"].get("mocne_min") == 20, w["interwaly.fit"])
    sprawdz("FIT z polami deweloperskimi czyta się tak samo", w["dev.fit"] == f, w["dev.fit"])
    sprawdz("TCX: 30 min, 4,5 km, tętno, 15 mocnych minut", w["bieg.tcx"] == {"data": "2026-11-10", "zrodlo": "tcx", "min": 30, "km": 4.5, "hr_sr": 155, "hr_max": 170, "mocne_min": 15}, w["bieg.tcx"])
    g = w["bieg.gpx"]
    sprawdz("GPX: 20 min, dystans ze współrzędnych 3,6 km, tętno", g.get("min") == 20 and abs(g.get("km", 0) - 3.6) < 0.02 and g.get("hr_sr") == 145, g)
    sprawdz("z pliku nie zostają współrzędne ani przebieg", all("lat" not in json.dumps(x) and "_hr" not in x for x in (f, g, w["bieg.tcx"])))
    sprawdz("zły plik FIT daje zrozumiały błąd", "nie jest plik FIT" in w["zly.fit"].get("blad", ""), w["zly.fit"])
    sprawdz("GPX bez czasu (sama trasa) daje zrozumiały błąd", "to trasa" in w["trasa.gpx"].get("blad", ""), w["trasa.gpx"])
    o = [x["pkt"] for x in w["oceny"]]
    sprawdz("ocena: spokojny zgodny z planem = 10", o[0] == 10, o)
    sprawdz("ocena: spokojny z tętnem 10 powyżej celu = 5 i rada", o[1] == 5 and "zacznij wolniej" in w["oceny"][1]["opis"], w["oceny"][1])
    sprawdz("ocena: połowa czasu = 5", o[2] == 5, o)
    sprawdz("ocena: akcent z planowanymi mocnymi minutami = 10, z jedną czwartą = 7", o[3] == 10 and o[4] == 7, o)
    sprawdz("ocena: bez tętna liczy się tylko czas (45 z 60 min = 5)", o[5] == 5 and "tylko czas" in w["oceny"][5]["opis"], w["oceny"][5])
    sprawdz("ocena: bieg w dniu wolnym nie dostaje punktów", o[6] is None, o)
    sprawdz("ocena: spokojny z odczuciem 8/10 = 6 i rada", o[7] == 6 and "za ciężko" in w["oceny"][7]["opis"], w["oceny"][7])
    k = w["wsk"]
    sprawdz("obciążenie: pusty dziennik i za mało danych mówią to wprost", "pusty" in k[0]["rady"][0]["tekst"] and "Za mało danych" in k[1]["rady"][0]["tekst"], k[:2])
    sprawdz("obciążenie: równy trening → bezpiecznie", k[2]["rady"][0]["poziom"] == "ok" and 0.8 < k[2]["acwr"] < 1.3, k[2])
    sprawdz("obciążenie: skok w ostatnim tygodniu → jasne „co zrobić”", k[3]["acwr"] > 1.5 and "zamień na spokojny bieg" in k[3]["rady"][0]["tekst"], k[3])
    sprawdz("obciążenie: tydzień przerwy → wracaj stopniowo", "wracaj stopniowo" in k[4]["rady"][0]["tekst"], k[4])
    for n in w:
        if n.startswith("PRAWDZIWY:"): print("     ", n, w[n])
    print("WSZYSTKO OK" if all(wyniki) else "SĄ BŁĘDY"); sys.exit(0 if all(wyniki) else 1)
