#!/usr/bin/env python3
"""Test pracy offline (krok 6): strona z serwera instaluje service worker i po odcięciu sieci nadal się otwiera.
Wymaga: playwright z Chromium. Uruchom: python3 build.py && python3 tests/test_offline.py
"""
import functools, http.server, json, pathlib, sys, threading
from playwright.sync_api import sync_playwright

DIST = pathlib.Path(__file__).parent.parent / "dist"
wyniki = []

def sprawdz(nazwa, w, szczegoly=""):
    wyniki.append(bool(w)); print(("OK   " if w else "BŁĄD ") + nazwa + ("" if w else f" – {szczegoly}"))

class Cicho(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Cicho, directory=str(DIST)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
adres = f"http://localhost:{srv.server_port}/"

with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(viewport={"width": 390, "height": 800}); page = ctx.new_page()
    zadania, bledy = [], []
    page.on("request", lambda r: zadania.append(r.url))
    page.on("pageerror", lambda e: bledy.append(str(e)))
    page.goto(adres)
    page.evaluate("navigator.serviceWorker.ready.then(() => true)")
    page.reload(); page.locator("#w-start").wait_for()
    man = json.loads((DIST / "manifest.webmanifest").read_text(encoding="utf-8"))
    sprawdz("manifest: nazwa, ikona, tryb samodzielny", man["short_name"] == "IPB" and man["display"] == "standalone" and (DIST / man["icons"][0]["src"]).exists())
    sprawdz("service worker działa i steruje stroną", page.evaluate("!!navigator.serviceWorker.controller"))
    ctx.set_offline(True)
    page.reload(); page.locator("#w-start").wait_for(timeout=15000)
    sprawdz("bez sieci strona nadal się otwiera", page.is_visible("#zacznij") and "IPB" in page.inner_text("header.pasek"))
    page.click("#zacznij"); page.click("#przyklad"); page.click("#wywiad-dalej")
    page.fill("#haslo-nowe", "kon bateria zszywka 42"); page.fill("#haslo-powt", "kon bateria zszywka 42"); page.click("#haslo-zapisz")
    page.locator("#w-kod:not([hidden])").wait_for(timeout=60000); page.check("#kod-potw"); page.click("#kod-dalej")
    sprawdz("bez sieci da się założyć sejf i ułożyć plan", page.locator("details.tydzien").count() >= 8)
    page.click("nav.zakladki button[data-z=zapis]")
    sprawdz("ekran „Co jest zapisane” potwierdza pracę bez sieci", "działa bez sieci" in page.inner_text("#offline-stan"))
    ctx.set_offline(False)
    sprawdz("wszystkie żądania szły tylko do własnego serwera", zadania and all(u.startswith(adres) for u in zadania), [u for u in zadania if not u.startswith(adres)][:3])
    sprawdz("ścieżki /__* nie są przechwytywane przez service worker", "pathname.includes('/__')" in (DIST / "sw.js").read_text(encoding="utf-8"))
    sprawdz("brak błędów strony", not bledy, bledy[:2])
    br.close()
srv.shutdown()
print("WSZYSTKO OK" if all(wyniki) else "SĄ BŁĘDY"); sys.exit(0 if all(wyniki) else 1)
