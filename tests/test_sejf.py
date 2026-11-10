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
    page.wait_for_function("!document.getElementById('otworz').disabled", timeout=60000)

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
    plan1 = page.inner_text("#plan-tygodnie")
    sprawdz("każdy bieg ma cel; bez pomiaru tętno jest oznaczone jako szacunek", "tętno do 145 · tempo" in plan1 and "(tętno to szacunek)" in plan1)
    page.click("nav.zakladki button[data-z=strefy]")
    sprawdz("strefy: modele obok siebie i tempa z ostatniego wyniku",
            page.locator("#strefy-modele .karta").count() == 3 and page.is_visible("#progi-szacunek") and "Próg" in page.inner_text("#strefy-modele"))
    page.click("#t-zapisz")
    sprawdz("pusty wynik testu odrzucony", "między 90 a 220" in page.inner_text("#t-info"))
    page.fill("#t-lthr", "170"); page.fill("#t-hrmax", "186"); page.click("#t-zapisz")
    page.wait_for_function("document.getElementById('t-info').textContent.startsWith('Zapisano')")
    sprawdz("wynik testu 30 min zmienia progi na zmierzone", "170 (zmierzone)" in page.inner_text("#progi-dl") and page.is_hidden("#progi-szacunek"))
    page.click("nav.zakladki button[data-z=plan]")
    plan2 = page.inner_text("#plan-tygodnie")
    sprawdz("po teście plan ma nowe tętno i nie jest już szacunkiem", "tętno do 151" in plan2 and "szacunek" not in plan2)
    sprawdz("przeliczenie nie przesunęło tygodni", page.locator("details.tydzien summary").first.inner_text() == pierwszy_tydzien)
    page.click("nav.zakladki button[data-z=strefy]"); page.select_option("#t-rodzaj", "kontrolny")
    page.select_option("#t-dyst", "10"); page.fill("#t-czas", "0:58:00"); page.fill("#t-data", "2026-12-20"); page.click("#t-zapisz")
    page.wait_for_function("document.getElementById('t-info').textContent.startsWith('Zapisano')")
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
