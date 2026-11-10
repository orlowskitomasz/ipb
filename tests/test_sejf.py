#!/usr/bin/env python3
"""Test przeglądarkowy kroku 1 (sejf + wywiad). Wymaga: playwright z Chromium.
Uruchom: python3 build.py && python3 tests/test_sejf.py
"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright

STRONA = (pathlib.Path(__file__).parent.parent / "dist/index.html").as_uri()
HASLO, NOWE = "kon bateria zszywka 42", "inne dlugie haslo 2026"
# tylko znaczniki, które nie mogą trafić się przypadkiem w zaszyfrowanym tekście (base64 nie ma „_”, „:” ani cudzysłowu w środku)
JAWNE = ["rok_urodzenia", "0:52:30", '"profil"', '"hrmax"', '"tygodnie"', "regularnie", "obciazenie"]
wyniki = []

def sprawdz(nazwa, warunek):
    wyniki.append(bool(warunek)); print(("OK   " if warunek else "BŁĄD ") + nazwa)

def widoczny(page, sekcja):
    page.wait_for_selector(f"#w-{sekcja}:not([hidden])", timeout=60000)

def surowe(page):
    return page.evaluate("localStorage.getItem('ipb.sejf.v1')")

def otworz(page, haslo):
    page.fill("#haslo-otworz", haslo); page.click("#otworz")
    page.locator("#otworz:not([disabled])").wait_for(state="attached", timeout=60000)

with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={"width": 390, "height": 800}, has_touch=True)
    page = ctx.new_page()
    zadania, bledy = [], []
    page.on("request", lambda r: zadania.append(r.url))
    page.on("pageerror", lambda e: bledy.append(str(e)))
    page.on("console", lambda m: bledy.append(m.text) if m.type == "error" else None)
    page.goto(STRONA)

    widoczny(page, "start")
    page.click("#zacznij"); page.click("#przyklad"); page.click("#wywiad-dalej")
    widoczny(page, "haslo")
    page.fill("#haslo-nowe", "krotkie"); page.fill("#haslo-powt", "krotkie"); page.click("#haslo-zapisz")
    sprawdz("za krótkie hasło odrzucone", page.is_visible("#blad-haslo") and surowe(page) is None)
    page.fill("#haslo-nowe", HASLO); page.fill("#haslo-powt", HASLO); page.click("#haslo-zapisz")
    widoczny(page, "kod")
    kod = page.inner_text("#kod-odz")
    sprawdz("kod odzyskiwania: 8 grup po 4 znaki", len(kod.split("-")) == 8 and all(len(g) == 4 for g in kod.split("-")))
    sprawdz("bez potwierdzenia kodu nie da się przejść dalej", page.is_disabled("#kod-dalej"))
    page.check("#kod-potw"); page.click("#kod-dalej"); widoczny(page, "otwarty")

    s = surowe(page)
    sprawdz("w pamięci przeglądarki nie ma danych otwartym tekstem", s and not any(j in s for j in JAWNE))
    sprawdz("koperta: Argon2id + osobne opakowanie hasłem i kodem",
            json.loads(s)["haslo"]["kdf"]["alg"] == "argon2id" and json.loads(s)["kod"]["kdf"]["alg"] == "argon2id")
    sprawdz("po założeniu sejfu od razu jest plan: tygodnie po 7 dni", page.locator("details.tydzien").count() >= 8
            and page.locator("details.tydzien").first.locator(".dzien").count() == 7)
    sprawdz("widok prosty mówi „po co”, szczegółowy pokazuje rozpiskę",
            "Buduje wytrzymałość" in page.inner_text("#plan-tygodnie") and "Rozgrzewka 10–15 min" not in page.inner_text("#plan-tygodnie"))
    pierwszy_tydzien = page.locator("details.tydzien summary").first.inner_text()
    page.click("#widok-pelny")
    sprawdz("widok szczegółowy pokazuje rozpiskę treningu", "Rozgrzewka 10–15 min" in page.inner_text("#plan-tygodnie"))
    sprawdz("plan z testem tętna, bo w przykładzie brak HRmax", "Tydzień 2: test 30 min" in page.inner_text("#plan-bramki"))
    sprawdz("telefon 390 px: plan bez przewijania w bok", page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    # --- własny układ tygodnia: zamiana dni, ostrzeżenie, podpowiedź, trwałość, cofnięcie ---
    sprawdz("plan z generatora nie ma ostrzeżeń", page.locator("#plan-tygodnie .komunikat").count() == 0)
    page.click("#edycja"); page.select_option('[data-zamien="1-wt"]', "sr")
    page.wait_for_selector("#plan-tygodnie .komunikat.zle")
    sprawdz("zamiana wt↔śr daje ostrzeżenie z powodem", "Dwa mocne dni pod rząd: środa i czwartek" in page.inner_text("#plan-tygodnie")
            and "potrzebuje co najmniej jednego lżejszego dnia" in page.inner_text("#plan-tygodnie")
            and "Reguła R3 · źródło klasy B · pewność średnia" in page.inner_text("#plan-tygodnie"))
    page.reload(); widoczny(page, "zamkniety"); otworz(page, HASLO); widoczny(page, "otwarty")
    sprawdz("przestawiony plan i ostrzeżenie zostają po odświeżeniu", "Dwa mocne dni pod rząd" in page.inner_text("#plan-tygodnie")
            and "uwagi: 2" in page.locator("details.tydzien summary").first.inner_text()
            and "Skoki (plyometria) dzień przed mocnym treningiem" in page.inner_text("#plan-tygodnie"))
    page.click("#edycja"); page.click('[data-odpusc="1-nd"]')
    page.locator("#plan-tygodnie", has_text="nie ma długiego biegu").wait_for(timeout=60000)
    sprawdz("odpuszczony długi bieg daje podpowiedź", "najważniejszym treningiem tygodnia" in page.inner_text("#plan-tygodnie"))
    page.click('[data-cofnij="1"]')
    page.locator("#plan-tygodnie .komunikat").first.wait_for(state="detached", timeout=60000)
    sprawdz("cofnięcie zmian przywraca tydzień", page.locator("details.tydzien summary").first.inner_text() == pierwszy_tydzien)
    page.click("#edycja")
    plan1 = page.inner_text("#plan-tygodnie")
    sprawdz("każdy bieg ma cel; bez pomiaru tętno jest oznaczone jako szacunek", "tętno do 145 · tempo" in plan1 and "(tętno to szacunek)" in plan1)
    page.click("nav.zakladki button[data-z=strefy]")
    sprawdz("strefy: modele obok siebie i tempa z ostatniego wyniku",
            page.locator("#strefy-modele .karta").count() == 3 and page.is_visible("#progi-szacunek") and "Próg" in page.inner_text("#strefy-modele"))
    page.click("#t-zapisz")
    sprawdz("pusty wynik testu odrzucony", "między 90 a 220" in page.inner_text("#t-info"))
    page.fill("#t-lthr", "170"); page.fill("#t-hrmax", "186"); page.click("#t-zapisz")
    page.locator("#t-info", has_text="Zapisano").wait_for(timeout=60000)
    sprawdz("wynik testu 30 min zmienia progi na zmierzone", "170 (zmierzone)" in page.inner_text("#progi-dl") and page.is_hidden("#progi-szacunek"))
    page.click("nav.zakladki button[data-z=plan]")
    plan2 = page.inner_text("#plan-tygodnie")
    sprawdz("po teście plan ma nowe tętno i nie jest już szacunkiem", "tętno do 151" in plan2 and "szacunek" not in plan2)
    sprawdz("przeliczenie nie przesunęło tygodni", page.locator("details.tydzien summary").first.inner_text() == pierwszy_tydzien)
    page.click("nav.zakladki button[data-z=strefy]"); page.select_option("#t-rodzaj", "kontrolny")
    page.select_option("#t-dyst", "10"); page.fill("#t-czas", "0:58:00"); page.fill("#t-data", "2026-12-20"); page.click("#t-zapisz")
    page.locator("#t-info", has_text="Zapisano").wait_for(timeout=60000)
    page.click("nav.zakladki button[data-z=plan]")
    sprawdz("słabszy bieg kontrolny zmienia ocenę celu i daje cel pośredni", "nierealny" in page.inner_text("#plan-cel") and "2:08" in page.inner_text("#plan-cel"))
    sprawdz("zapisane wyniki są w sejfie, nie otwartym tekstem", "0:58:00" not in surowe(page))
    page.click("nav.zakladki button[data-z=profil]")
    sprawdz("ocena celu po wynikach: nierealny", page.inner_text("#ocena-status") == "nierealny")
    sprawdz("po wpisaniu testu zapowiedź testu tętna znika", page.is_hidden("#brak-tetna"))
    page.click("nav.zakladki button[data-z=zapis]")
    sprawdz("ekran „Co jest zapisane” pokazuje 0 połączeń", page.inner_text("#siec-ile").startswith("0"))
    sprawdz("telefon 390 px: brak przewijania w bok", page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    kopia = page.input_value("#kopia-tekst")

    page.click("#zablokuj"); widoczny(page, "zamkniety")
    otworz(page, "zle haslo zle haslo")
    sprawdz("złe hasło nie otwiera sejfu", page.is_visible("#blad-otworz") and page.is_hidden("#w-otwarty"))
    otworz(page, HASLO); widoczny(page, "otwarty"); page.click("nav.zakladki button[data-z=profil]")
    sprawdz("dobre hasło otwiera sejf", "1988" in page.inner_text("#profil-dl"))

    page.click("#edytuj"); page.fill("#f-rok", "1990"); page.click("#wywiad-dalej"); widoczny(page, "otwarty")
    page.reload(); widoczny(page, "zamkniety")
    sprawdz("po odświeżeniu strony sejf jest zamknięty", page.is_hidden("#w-otwarty"))
    otworz(page, HASLO); widoczny(page, "otwarty"); page.click("nav.zakladki button[data-z=profil]")
    sprawdz("zmiana danych przetrwała odświeżenie", "1990" in page.inner_text("#profil-dl"))

    page.click("#zablokuj"); page.click("#przelacz-kod"); page.fill("#kod-wpisz", kod.lower().replace("-", " ")); page.click("#otworz")
    widoczny(page, "haslo")
    page.fill("#haslo-nowe", NOWE); page.fill("#haslo-powt", NOWE); page.click("#haslo-zapisz"); widoczny(page, "otwarty")
    page.click("#zablokuj")
    otworz(page, HASLO)
    sprawdz("po odzyskaniu kodem stare hasło nie działa", page.is_visible("#blad-otworz"))
    otworz(page, NOWE); widoczny(page, "otwarty"); page.click("nav.zakladki button[data-z=profil]")
    sprawdz("nowe hasło działa", "1990" in page.inner_text("#profil-dl"))

    page.click("nav.zakladki button[data-z=zapis]"); page.click("#usun2"); page.click("#usun-nie")
    sprawdz("„Nie, zostaw” niczego nie usuwa", surowe(page) is not None)
    page.click("#usun2"); page.click("#usun-tak"); widoczny(page, "start")
    sprawdz("„Usuń wszystko” czyści pamięć przeglądarki", surowe(page) is None)

    page.click("details summary"); page.fill("#przywroc-tekst", "to nie kopia"); page.click("#przywroc")
    sprawdz("zły tekst kopii odrzucony", page.is_visible("#blad-przywroc"))
    page.fill("#przywroc-tekst", kopia); page.click("#przywroc"); widoczny(page, "zamkniety")
    otworz(page, HASLO); widoczny(page, "otwarty")
    sprawdz("kopia zapasowa przywraca też plan", page.locator("details.tydzien").count() >= 8)
    page.click("nav.zakladki button[data-z=profil]")
    sprawdz("kopia zapasowa przywraca sejf (stare hasło, stare dane)", "1988" in page.inner_text("#profil-dl"))

    # --- dziennik: wpis ręczny, plik z zegarka, plan a wykonanie, usuwanie ---
    from test_dziennik import tcx
    page.click("nav.zakladki button[data-z=dziennik]")
    sprawdz("pusty dziennik mówi to wprost", "Dziennik jest pusty" in page.inner_text("#dz-rady"))
    sroda = page.evaluate("(() => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7) + 2); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })()")
    page.click("#dz-dodaj")
    sprawdz("bieg bez czasu odrzucony", "Podaj datę i czas" in page.inner_text("#dz-info"))
    page.fill("#dz-data", sroda); page.fill("#dz-min", "28"); page.fill("#dz-km", "4.4"); page.fill("#dz-hr", "140"); page.select_option("#dz-odczucie", "4"); page.click("#dz-dodaj")
    page.locator("#dz-lista", has_text="28 min").wait_for(timeout=60000)
    sprawdz("wpis ręczny: ocena względem planu na ten dzień, słowami zamiast punktów", "Zgodnie z planem" in page.inner_text("#dz-lista") and "4,4 km" in page.inner_text("#dz-lista") and "/10." not in page.inner_text("#dz-lista"))
    page.set_input_files("#dz-plik", {"name": "bieg.tcx", "mimeType": "application/xml", "buffer": tcx()})
    page.locator("#dz-info", has_text="Dodano z pliku: 1").wait_for(timeout=60000)
    sprawdz("plik TCX z zegarka trafia do dziennika (30 min, 4,5 km, tętno 155)", "30 min · 4,5 km · śr. tętno 155" in page.inner_text("#dz-lista") and "Z pliku TCX" in page.inner_text("#dz-lista"))
    page.set_input_files("#dz-plik", {"name": "bieg.tcx", "mimeType": "application/xml", "buffer": tcx()})
    page.locator("#dz-info", has_text="Pominięto już zapisane: 1").wait_for(timeout=60000)
    page.set_input_files("#dz-plik", {"name": "zly.fit", "mimeType": "application/octet-stream", "buffer": b"to nie fit"})
    page.locator("#dz-info", has_text="To nie jest plik FIT").wait_for(timeout=60000)
    sprawdz("ten sam plik drugi raz i zły plik nie psują dziennika", page.locator("#dz-lista .bieg").count() == 2)
    sd = surowe(page)
    sprawdz("dziennik jest w sejfie, nie otwartym tekstem", '"dziennik"' not in sd and sroda not in sd)
    page.click("nav.zakladki button[data-z=plan]")
    sprawdz("plan pokazuje wykonanie przy dniu", "Wykonano: 28 min · 4,4 km · śr. tętno 140 · odczucie 4/10. Zgodnie z planem." in page.inner_text("#plan-tygodnie"))
    page.click("nav.zakladki button[data-z=dziennik]")
    sprawdz("plan a wykonanie: tydzień pojawia się, gdy plan już trwa (teraz jeszcze nie)", "najbliższy poniedziałek" in page.inner_text("#dz-tygodnie") or "Tydz. 1" in page.inner_text("#dz-tygodnie"))
    page.click(f'[data-usun="{sroda}"]')
    page.locator("#dz-lista .bieg").nth(1).wait_for(state="detached", timeout=60000)
    sprawdz("usunięty bieg znika z dziennika", "28 min" not in page.inner_text("#dz-lista"))
    sprawdz("telefon 390 px: dziennik bez przewijania w bok", page.evaluate("document.documentElement.scrollWidth <= innerWidth"))

    page.clock.install(); page.click("#zablokuj"); otworz(page, HASLO); widoczny(page, "otwarty")
    page.clock.fast_forward(16 * 60 * 1000)
    sprawdz("automatyczna blokada po 15 minutach", page.is_visible("#w-zamkniety"))

    # ta sama strona w ramce bez allow-forms i bez dostępu do pamięci (tak działają podglądy osadzone)
    ctx2 = br.new_context(viewport={"width": 390, "height": 800})
    ctx2.route("https://ipb.test/", lambda r: r.fulfill(content_type="text/html",
               body='<iframe id="f" sandbox="allow-scripts" style="width:390px;height:800px;border:0"></iframe>'))
    ramka = ctx2.new_page(); ramka.goto("https://ipb.test/")
    ramka.evaluate("h => { document.getElementById('f').srcdoc = h }", pathlib.Path(STRONA[7:]).read_text(encoding="utf-8"))
    f = ramka.frame_locator("#f")
    f.locator("#zacznij").click(); f.locator("#przyklad").click(); f.locator("#wywiad-dalej").click()
    f.locator("#haslo-nowe").fill(HASLO); f.locator("#haslo-powt").fill(HASLO); f.locator("#haslo-powt").press("Enter")
    f.locator("#w-kod:not([hidden])").wait_for(timeout=60000)
    f.locator("#kod-potw").check(); f.locator("#kod-dalej").click()
    sprawdz("w osadzonej ramce przyciski i Enter działają", f.locator("#w-otwarty").is_visible())
    sprawdz("bez dostępu do pamięci strona ostrzega, że dane znikną", f.locator("#ostrz-pamiec").is_visible())

    sprawdz("strona nie wykonała żadnego połączenia poza własnym plikiem", zadania and all(u == STRONA for u in zadania))
    sprawdz("brak błędów w konsoli", not bledy)
    for b in bledy: print("   ", b)
    br.close()

print("WSZYSTKO OK" if all(wyniki) else "SĄ BŁĘDY")
sys.exit(0 if all(wyniki) else 1)
