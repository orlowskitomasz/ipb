#!/usr/bin/env python3
"""Test przeglądarkowy kroku 7: trasa i pogoda dnia. Wymaga: playwright z Chromium i node.
Serwery tras, pogody i map są atrapami (prawdziwe nie są odpytywane); test pilnuje, dokąd i co strona wysyła.
Uruchom: python3 build.py && python3 tests/test_mapa.py
"""
import base64, json, pathlib, re, subprocess, sys, urllib.parse
from playwright.sync_api import sync_playwright

TU = pathlib.Path(__file__).parent
STRONA = (TU.parent / "dist/index.html").as_uri()
HASLO = "kon bateria zszywka 42"
DOZWOLONE = {"brouter.de", "api.open-meteo.com", "tile.openstreetmap.org"}
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
wyniki = []

def sprawdz(nazwa, w, szczegoly=""):
    wyniki.append(bool(w)); print(("OK   " if w else "BŁĄD ") + nazwa + ("" if w else f" – {szczegoly}"))

def pogoda(url):
    data = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)["start_date"][0]
    g = range(24)
    return json.dumps({"hourly": {"time": [f"{data}T{h:02d}:00" for h in g], "temperature_2m": [4] * 24, "apparent_temperature": [1] * 24, "precipitation": [0.5 if h == 17 else 0 for h in g],
        "precipitation_probability": [60] * 24, "wind_speed_10m": [14] * 24, "wind_direction_10m": [270] * 24, "wind_gusts_10m": [30] * 24, "weather_code": [61 if h == 17 else 3 for h in g], "is_day": [1 if 7 <= h < 16 else 0 for h in g]}})

with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={"width": 390, "height": 800}, has_touch=True, geolocation={"latitude": 52.2297, "longitude": 21.0122}, permissions=["geolocation"], accept_downloads=True)
    zadania, bledy = [], []
    ctx.route("https://brouter.de/**", lambda r: r.fulfill(content_type="application/json", headers={"access-control-allow-origin": "*"},
              body=subprocess.run(["node", str(TU / "brouter_atrapa.js"), r.request.url], capture_output=True, text=True).stdout))
    ctx.route("https://api.open-meteo.com/**", lambda r: r.fulfill(content_type="application/json", headers={"access-control-allow-origin": "*"}, body=pogoda(r.request.url)))
    ctx.route("https://tile.openstreetmap.org/**", lambda r: r.fulfill(content_type="image/png", body=PNG))
    page = ctx.new_page()
    page.on("request", lambda r: zadania.append(r))
    page.on("pageerror", lambda e: bledy.append(str(e)))
    host = lambda r: urllib.parse.urlparse(r.url).hostname
    obce = lambda: [r.url for r in zadania if r.url != STRONA]
    page.goto(STRONA)
    page.click("#zacznij"); page.click("#przyklad"); page.click("#wywiad-dalej")
    page.fill("#haslo-nowe", HASLO); page.fill("#haslo-powt", HASLO); page.click("#haslo-zapisz")
    page.locator("#w-kod:not([hidden])").wait_for(timeout=60000); page.check("#kod-potw"); page.click("#kod-dalej")
    page.click("#widok-pelny")
    page.evaluate("document.querySelectorAll('details.tydzien').forEach((d) => { d.open = true })")

    page.locator(".dzien:has-text('Spokojny bieg') [data-trasa]").first.click()
    sprawdz("przed zgodą: wyjaśnienie, co i dokąd pójdzie; mapa ukryta; zero połączeń", page.is_visible("#trasa-zgoda") and not page.is_visible("#mapa") and "brouter.de" in page.inner_text("#trasa-zgoda") and not obce(), obce()[:3])
    adres = page.inner_text("#tr-adres") if page.is_visible("#tr-adres") else ""
    sprawdz("z pliku na dysku: ostrzeżenie, że mapa wymaga strony https, z adresem i przeniesieniem sejfu", "https://orlowskitomasz.github.io/ipb/" in adres and "Kopia zapasowa" in adres, adres[:120])
    page.click("#siec-wlacz"); page.locator("#trasa-srodek:not([hidden])").wait_for(timeout=60000)
    sprawdz("po zgodzie: mapa widoczna, długość trasy policzona z treningu", page.is_visible("#mapa") and 3 <= float(page.input_value("#tr-km")) <= 15, page.input_value("#tr-km"))
    page.click("#tr-szukaj")
    sprawdz("przy mapie całej Polski szukanie prosi o przybliżenie, nic nie wysyła do serwera tras", "Przybliż mapę" in page.inner_text("#tr-info") and not any(host(r) == "brouter.de" for r in zadania))
    page.fill("#tr-wsp", "Kraków"); page.click("#tr-wsp-ok")
    sprawdz("błędne współrzędne: komunikat zamiast przesunięcia mapy", "Nie rozpoznałem" in page.inner_text("#tr-info"))
    page.fill("#tr-wsp", "50,0614, 19,9366"); page.click("#tr-wsp-ok"); page.locator("#mapa-kafle img").first.wait_for(state="attached")
    sprawdz("start ze współrzędnych ustawia mapę (bez sieci poza kafelkami)", "wpisanym punkcie" in page.inner_text("#tr-info") and any(host(r) == "tile.openstreetmap.org" and "/15/" in r.url for r in zadania) and not any(host(r) == "brouter.de" for r in zadania))
    page.click("#tr-gps"); page.locator("#tr-info:has-text('Twoim położeniu')").wait_for(timeout=15000)
    page.locator("#mapa-kafle img").first.wait_for(state="attached")
    sprawdz("„Moje położenie” ustawia mapę i pobiera kafelki", page.locator("#mapa-kafle img").count() >= 2 and any(host(r) == "tile.openstreetmap.org" and "/15/" in r.url for r in zadania))
    km = float(page.input_value("#tr-km"))
    page.click("#tr-szukaj"); page.locator(".propozycja").first.wait_for(timeout=120000)
    n = page.locator(".propozycja").count()
    sprawdz("szukanie: od 1 do 3 propozycji z opisem „dlaczego”", 1 <= n <= 3 and "skrzyżowania" in page.inner_text(".propozycja") and "zieleń" in page.inner_text(".propozycja"), n)
    dl = [float(x.replace(",", ".")) for x in re.findall(r"^Propozycja \d\n([\d,]+) km", page.inner_text("#tr-lista"), re.M)]
    sprawdz("R23: każda propozycja w ±8% długości treningu", len(dl) == n and all(abs(d - km) <= km * 0.08 + 0.05 for d in dl), (km, dl))
    sprawdz("trasa narysowana na mapie", page.locator("#mapa-rys polyline").count() >= 2 and page.locator("#mapa-rys circle").count() == 1)
    tras = [r for r in zadania if host(r) == "brouter.de"]
    sprawdz("do serwera tras idą tylko współrzędne: bez ciasteczek, bez adresu strony", tras and all(set(urllib.parse.parse_qs(urllib.parse.urlparse(r.url).query)) == {"lonlats", "profile", "alternativeidx", "format"}
            and "cookie" not in r.headers and "referer" not in r.headers for r in tras), len(tras))
    sprawdz("zapytania o trasę najwyżej 27 na jedno szukanie", len(tras) <= 27, len(tras))

    page.click("#tr-pogoda-btn"); page.locator("#tr-pogoda:has-text('Open-Meteo')").wait_for(timeout=15000)
    t = page.inner_text("#tr-pogoda")
    sprawdz("pogoda dla godzin biegu ze źródłem i godziną pobrania", "deszcz" in t and "4°C" in t and "pobrano" in t and "wiatr 14 km/h z kierunku W" in t, t)
    sprawdz("R25: bieg o 17:00 w listopadzie – ostrzeżenie o ciemności, bez zmiany planu", "po ciemku" in t and "plan się przez nią nie zmienia" in t, t)
    pog = [r for r in zadania if host(r) == "api.open-meteo.com"]
    sprawdz("do pogody idzie obszar zaokrąglony do 0,1° i data; bez adresu strony", len(pog) == 1 and "latitude=52.2&" in pog[0].url and "longitude=21.0&" in pog[0].url and "referer" not in pog[0].headers, [r.url for r in pog])
    page.click("#tr-pogoda-btn"); page.wait_for_timeout(300)
    sprawdz("pogoda z pamięci przez 3 godziny (bez drugiego zapytania)", len([r for r in zadania if host(r) == "api.open-meteo.com"]) == 1)

    if len(sys.argv) > 1: page.locator("#trasa").screenshot(path=sys.argv[1] + ".png")
    with page.expect_download() as d: page.locator("[data-gpx]").first.click()
    gpx = pathlib.Path(d.value.path()).read_text(encoding="utf-8")
    sprawdz("plik GPX: ślad i znacznik Start", gpx.count("<trkpt") > 50 and "<name>Start</name>" in gpx and d.value.suggested_filename.endswith(".gpx"))
    page.evaluate("window.print = () => {}")
    page.locator("[data-karta-trasy]").first.click()
    sprawdz("karta trasy do druku: mapa z trasą, profil wysokości, pogoda, podpis OpenStreetMap", page.locator("#druk .mapa polyline").count() >= 1 and page.locator("#druk svg.profil polyline").count() == 1
            and "Open-Meteo" in page.inner_text("#druk") if page.emulate_media(media="print") is None else False)
    pdf = page.pdf(prefer_css_page_size=True); stron = len(re.findall(rb"/Type\s*/Page[^s]", pdf)); page.emulate_media(media="screen")
    if len(sys.argv) > 1: pathlib.Path(sys.argv[1]).write_bytes(pdf)
    sprawdz("karta trasy mieści się na jednej stronie", stron == 1, stron)

    page.locator("[data-zapisz-trase]").first.click(); page.locator("#tr-info:has-text('Trasa zapisana')").wait_for(timeout=60000)
    s = page.evaluate("localStorage.getItem('ipb.sejf.v1')")
    sprawdz("zapisana trasa i zgoda na sieć są w sejfie, nie otwartym tekstem", '"pts"' not in s and '"siec"' not in s and "21.01" not in s)
    page.click("#zablokuj"); page.fill("#haslo-otworz", HASLO); page.click("#otworz"); page.locator("#w-otwarty:not([hidden])").wait_for(timeout=60000)
    sprawdz("po zablokowaniu trasa znika z ekranu", page.locator(".propozycja").count() == 0 and page.locator("#mapa-rys polyline").count() == 0)
    page.evaluate("document.querySelectorAll('details.tydzien').forEach((d) => { d.open = true })")
    page.locator("[data-trasa]:has-text('zapisana')").first.click()
    sprawdz("po ponownym otwarciu sejfu dzień pokazuje zapisaną trasę", "Trasa zapisana do tego dnia" in page.inner_text("#tr-lista") and page.locator("#mapa-rys polyline").count() >= 2)
    sprawdz("telefon 390 px: panel trasy bez przewijania w bok", page.evaluate("document.documentElement.scrollWidth <= innerWidth"))

    przed = len([r for r in zadania if host(r) == "brouter.de"])
    page.locator(".dzien:has-text('Mocny trening') [data-trasa]").first.click()
    page.click("#tr-start") if page.is_visible("#tr-start") else page.click("#tr-gps")
    page.wait_for_timeout(300); page.click("#tr-szukaj"); page.locator(".propozycja:has-text('Propozycja 1')").wait_for(timeout=120000)
    sprawdz("R24: dzień z odcinkami – liczone skrzyżowania w części głównej, odcinki zaznaczone na mapie", "w części głównej" in page.inner_text("#tr-lista") and "Rozgrzewka trwa tyle, ile w planie" in page.inner_text("#tr-lista")
            and page.locator("#mapa-rys polyline[stroke='#b3261e']").count() >= 1, page.inner_text("#tr-lista")[:300])

    page.click("nav.zakladki button[data-z=zapis]")
    dz = page.inner_text("#siec-dziennik")
    sprawdz("dziennik połączeń na ekranie: serwer i cel", "brouter.de" in dz and "trasa" in dz and "Mapy i pogoda: włączone" in page.inner_text("#siec-stan"), dz[:200])
    page.click("#siec-przelacz"); page.locator("#siec-stan:has-text('Teraz: nic')").wait_for(timeout=60000)
    ile = len(obce())
    page.click("nav.zakladki button[data-z=plan]"); page.evaluate("document.querySelectorAll('details.tydzien').forEach((d) => { d.open = true })")
    page.locator("[data-trasa]").first.click(); page.wait_for_timeout(300)
    sprawdz("po wyłączeniu: znowu pytanie o zgodę i żadnych nowych połączeń", page.is_visible("#trasa-zgoda") and not page.is_visible("#mapa") and len(obce()) == ile)
    zly = page.evaluate("fetch('https://example.com/').then(() => 'poszło', () => 'zablokowane')")
    sprawdz("połączenie z serwerem spoza listy blokuje sama przeglądarka (CSP)", zly == "zablokowane", zly)
    sprawdz("wszystkie połączenia tylko z trzema serwerami z listy", {host(r) for r in zadania if r.url != STRONA} - {"example.com"} <= DOZWOLONE, {host(r) for r in zadania})
    sprawdz("brak błędów strony", not bledy, bledy[:3])
    br.close()

print("WSZYSTKO OK" if all(wyniki) else f"BŁĘDY: {wyniki.count(False)}")
sys.exit(0 if all(wyniki) else 1)
