#!/usr/bin/env python3
"""Test tras i pogody (src/trasy.js): szukanie pętli na atrapie serwera tras, miary, GPX, pogoda, słońce. Wymaga: node.
Prawdziwy BRouter i Open-Meteo nie są tu odpytywane. Uruchom: python3 tests/test_trasy.py
"""
import json, pathlib, subprocess, sys

TU = pathlib.Path(__file__).parent
JS = r"""
const fs = require('fs'), path = require('path'), vm = require('vm');
const katalog = path.join(process.argv[1], '..', '..');
const c = {}; vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(katalog, 'src', 'trasy.js'), 'utf8') + '\nthis.T = Trasy;', c);
const atrapa = require(path.join(katalog, 'tests', 'brouter_atrapa.js')), T = c.T;
(async () => {
  const wy = {}, adresy = [];
  const pobierz = async (url) => { adresy.push(url); return atrapa(url); };
  const start = [21.0, 52.2];
  const w = await T.szukaj({ start, km: 10, glowna: null, pobierz });
  wy.trasy = w.trasy.map((t) => ({ dl: t.miary.dl, odStartu: T.odl(start, t.pts[0]), dlaczego: t.dlaczego, powt: t.miary.powt, skrz: t.miary.skrzyzowania, zielen: t.miary.zielen, punkty: t.punkty, n: t.pts.length, tiz: !!t.tam_i_z_powrotem }));
  wy.adresy = adresy.length; wy.obce = adresy.filter((a) => !a.startsWith(T.HOSTY.trasa + '/')).length;
  // ślepa odnoga i łączenie oznaczeń
  const surowa = T.czytajBrouter(JSON.parse(atrapa(T.urlTrasy(T.ksztalt('kolo', start, 0, 1500))))), czysta = T.wytnijOdnogi(surowa);
  wy.odnoga = T.narastajaco(surowa.pts).pop() - T.narastajaco(czysta.pts).pop();
  wy.surowe_oznaczenia = surowa.skrz.filter(Boolean).length; wy.maks_waga = Math.max(...surowa.skrz);
  const m0 = T.miary(surowa, null); wy.skrz_po_zlaczeniu = m0.skrzyzowania; wy.waga = m0.wagaSkrz;
  const tiz = T.czytajBrouter(JSON.parse(atrapa(T.urlTrasy(T.ksztalt('powrot', start, 90, 2000)))));
  const prosto = (a, b) => { const p = []; for (let i = 0; i <= 100; i++) p.push([a[0] + (b[0] - a[0]) * i / 100, a[1] + (b[1] - a[1]) * i / 100, 0]); return p; };
  const tam = prosto(start, T.przesun(start, 90, 2000)); wy.powt_tiz = T.powtorzenia([...tam, ...[...tam].reverse()]); wy.powt_petla = T.powtorzenia(czysta.pts);
  // część główna
  const kroki = [{ rola: 'rozgrzewka', czas_s: 600 }, { rola: 'praca', czas_s: 480 }, { rola: 'przerwa', czas_s: 90 }, { powtorz_od: 1, razy: 2 }, { rola: 'schlodzenie', otwarty: true }];
  wy.glowna = T.glownaCzesc(kroki, 360, 300); wy.bez_glownej = T.glownaCzesc([{ rola: 'praca', czas_s: 3000 }], 360, 300);
  const w2 = await T.szukaj({ start, km: 8, glowna: wy.glowna, pobierz });
  wy.z_glowna = w2.trasy.map((t) => ({ dl: t.miary.dl, g: t.miary.glowna, dlaczego: t.dlaczego }));
  wy.gpx = T.gpx('Mocny <trening>', w2.trasy[0].pts, wy.glowna); wy.gpx_pts = w2.trasy[0].pts.length;
  // błędy serwera
  const zle = await T.szukaj({ start: [21, 61], km: 10, pobierz }); wy.blad = zle.blad; wy.blad_trasy = zle.trasy.length;
  try { await T.szukaj({ start, km: 10, pobierz: async () => { const e = new Error('serwer tras jest przeciążony (429)'); e.przerwij = true; throw e; } }); wy.przerwane = false; } catch (e) { wy.przerwane = e.message; }
  // pogoda i słońce
  const godz = [...Array(24).keys()], h = { time: godz.map((g) => `2026-11-17T${String(g).padStart(2, '0')}:00`), temperature_2m: godz.map((g) => g), apparent_temperature: godz.map((g) => g - 2),
    precipitation: godz.map((g) => (g === 18 ? 1.2 : 0)), precipitation_probability: godz.map((g) => (g === 18 ? 70 : 10)), wind_speed_10m: godz.map(() => 10), wind_direction_10m: godz.map((g) => (g === 17 ? 350 : 10)),
    wind_gusts_10m: godz.map((g) => (g === 18 ? 31 : 20)), weather_code: godz.map((g) => (g === 18 ? 61 : g === 17 ? 3 : 0)), is_day: godz.map((g) => (g >= 7 && g < 16 ? 1 : 0)) };
  wy.pogoda = T.pogoda({ hourly: h }, 17, 18.5); wy.pogoda_brak = T.pogoda({ hourly: { time: [] } }, 17, 18); wy.url_pogody = T.urlPogody(52.2297, 21.0122, '2026-11-17');
  wy.slonce_lato = T.slonce(52.23, 21.01, '2026-06-21'); wy.slonce_zima = T.slonce(52.23, 21.01, '2026-12-21'); wy.polarna = T.slonce(78, 15, '2026-12-21');
  const px = T.naPiksele(21.0122, 52.2297, 14), zp = T.zPikseli(px[0], px[1], 14); wy.mapa = [px, zp, T.urlKafla(14, Math.floor(px[0] / 256), Math.floor(px[1] / 256))];
  console.log(JSON.stringify(wy));
})().catch((e) => { console.error(e); process.exit(1); });
"""
wyniki = []
def sprawdz(nazwa, w, szczegoly=""):
    wyniki.append(bool(w)); print(("OK   " if w else "BŁĄD ") + nazwa + ("" if w else f" – {szczegoly}"))

r = subprocess.run(["node", "-e", JS, str(TU / "x")], capture_output=True, text=True)
if r.returncode: print(r.stderr); sys.exit(1)
w = json.loads(r.stdout)
t = w["trasy"]
sprawdz("szukanie: od 1 do 3 propozycji", 1 <= len(t) <= 3, len(t))
sprawdz("R23: każda propozycja mieści się w ±8% dystansu treningu", all(abs(x["dl"] - 10000) <= 800 for x in t), [x["dl"] for x in t])
sprawdz("początek trasy nie dalej niż 1,5 km od Startu", all(x["odStartu"] <= 1500 for x in t))
sprawdz("propozycje posortowane od najlepszej, każda z opisem „dlaczego”", [x["punkty"] for x in t] == sorted((x["punkty"] for x in t), reverse=True) and all("km" in x["dlaczego"] and "skrzyżowania" in x["dlaczego"] for x in t))
sprawdz("pętle wygrywają z biegiem tam i z powrotem", not any(x["tiz"] for x in t) and all(x["powt"] < 0.35 for x in t), t)
sprawdz("zapytania po kolei, najwyżej 27, tylko do serwera tras", 0 < w["adresy"] <= 2 * 27 and w["obce"] == 0, w["adresy"])
sprawdz("ślepa odnoga 150 m wycięta przed liczeniem długości", 250 <= w["odnoga"] <= 350, w["odnoga"])
sprawdz("dwa oznaczenia bliżej niż 30 m liczone jako jedno skrzyżowanie z wyższą wagą", w["skrz_po_zlaczeniu"] == w["surowe_oznaczenia"] - 1 and w["maks_waga"] == 2, (w["surowe_oznaczenia"], w["skrz_po_zlaczeniu"]))
sprawdz("powtórzenia: tam i z powrotem ≈ 100%, pętla ≈ 0%", w["powt_tiz"] > 0.8 and w["powt_petla"] < 0.05, (w["powt_tiz"], w["powt_petla"]))
g = w["glowna"]
sprawdz("część główna: po 10 min rozgrzewki, dwa odcinki, bez schłodzenia", g and g["od"] == 1667 and len(g["odcinki"]) == 2 and g["odcinki"][1]["do"] == g["do"] == 1667 + 1600 + 250 + 1600, g)
sprawdz("spokojny bieg nie ma części głównej", w["bez_glownej"] is None)
sprawdz("R24: propozycje dla dnia z odcinkami mają policzoną część główną", w["z_glowna"] and all(x["g"] and "w części głównej" in x["dlaczego"] for x in w["z_glowna"]))
sprawdz("GPX: cały ślad, znaczniki Start, Start 1, Koniec 2; nazwa bez surowych znaczników", w["gpx"].count("<trkpt") == w["gpx_pts"] and "<name>Start</name>" in w["gpx"] and "<name>Start 1</name>" in w["gpx"] and "<name>Koniec 2</name>" in w["gpx"] and "&lt;trening&gt;" in w["gpx"])
sprawdz("tekst błędu serwera trafia do użytkownika, bez tras", w["blad_trasy"] == 0 and "target island" in w["blad"], w["blad"])
sprawdz("przeciążony serwer przerywa całe szukanie", w["przerwane"] and "429" in w["przerwane"], w["przerwane"])
p = w["pogoda"]
sprawdz("pogoda dla godzin biegu: średnia temperatura, suma opadu, najgorszy kod, porywy", p and p["temp"] == 18 and p["opad_mm"] == 1.2 and p["szansa_opadu"] == 70 and p["opis"] == "deszcz" and p["porywy"] == 31 and p["noc"], p)
sprawdz("wiatr uśredniany wektorowo (350° i 10° → z północy)", p["wiatr_z"] == "N" and 9 <= p["wiatr"] <= 10, p)
sprawdz("brak godzin w prognozie → brak pogody, nie błąd", w["pogoda_brak"] is None)
sprawdz("R25: do prognozy idzie obszar zaokrąglony do 0,1°, nie dokładny punkt", "latitude=52.2&" in w["url_pogody"] and "longitude=21.0&" in w["url_pogody"] and "52.22" not in w["url_pogody"], w["url_pogody"])
l, z = w["slonce_lato"], w["slonce_zima"]
sprawdz("słońce w Warszawie: 21.06 zachód ok. 19:01 UTC, 21.12 zachód ok. 14:25 UTC", abs(l["zachod"] - 19.02) < 0.1 and abs(z["zachod"] - 14.42) < 0.1 and z["zmierzch"] > z["zachod"], (l, z))
sprawdz("noc polarna: brak wschodu zamiast błędu", w["polarna"]["wschod"] is None)
px, zp, url = w["mapa"]
sprawdz("mapa: przeliczenie współrzędnych tam i z powrotem; adres kafelka", abs(zp[0] - 21.0122) < 1e-6 and abs(zp[1] - 52.2297) < 1e-6 and url == "https://tile.openstreetmap.org/14/9148/5394.png", (zp, url))
print("WSZYSTKO OK" if all(wyniki) else f"BŁĘDY: {wyniki.count(False)}")
sys.exit(0 if all(wyniki) else 1)
