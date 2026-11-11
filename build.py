#!/usr/bin/env python3
"""Składa aplikację w jeden plik. Uruchom: python3 build.py

dist/index.html     – pełna strona do wgrania na dowolny serwer albo otwarcia z dysku
dist/fragment.html  – ta sama treść bez <html>/<head> (do podglądu w miejscach, które dodają je same)
"""
import pathlib

R = pathlib.Path(__file__).parent
czytaj = lambda p: (R / p).read_text(encoding="utf-8")
LIB = "lib/hash-wasm-argon2-4.12.0.umd.min.js"   # MIT, wbudowane – żadnego pobierania w czasie działania

fragment = (czytaj("src/index.html")
            .replace("/*CSS*/", czytaj("src/style.css"))
            .replace("/*LIB*/", czytaj(LIB))
            .replace("/*JS*/", "\n".join(czytaj(f"src/{m}.js") for m in ("sejf", "reguly", "prognoza", "strefy", "plan", "podpowiedzi", "walidator", "dziennik", "eksport", "app"))))

# Krok 1 nie łączy się z niczym: connect-src 'none'. Lista z docs/SPEC.md sekcja 11 dojdzie z mapami i pogodą.
CSP = ("default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; "
       "img-src data: 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; worker-src 'self'; manifest-src 'self'")
glowa = ('<!doctype html>\n<html lang="pl">\n<head>\n<meta charset="utf-8">\n'
         '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
         f'<meta http-equiv="Content-Security-Policy" content="{CSP}">\n'
         '<meta name="referrer" content="no-referrer">\n'
         '<link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="#0b6b5d">\n')

(R / "dist").mkdir(exist_ok=True)
(R / "dist/fragment.html").write_text(fragment, encoding="utf-8")
naglowek, tresc = fragment.split("</style>\n", 1)          # <title> i <style> do <head>, reszta do <body>
(R / "dist/index.html").write_text(glowa + naglowek + "</style>\n</head>\n<body>\n" + tresc + "\n</body>\n</html>\n", encoding="utf-8")

# Praca offline po wystawieniu na serwerze (krok 6): service worker, manifest i ikona obok index.html.
# Wersja pamięci podręcznej = skrót treści strony, więc każda nowa wersja wymienia starą.
import hashlib, json
wersja = hashlib.sha256((glowa + fragment).encode()).hexdigest()[:12]
(R / "dist/sw.js").write_text(czytaj("src/sw.js").replace("__WERSJA__", wersja), encoding="utf-8")
(R / "dist/icon.svg").write_text(czytaj("src/icon.svg"), encoding="utf-8")
(R / "dist/manifest.webmanifest").write_text(json.dumps({
    "name": "IPB – Indywidualny Plan Biegowy", "short_name": "IPB", "lang": "pl", "start_url": "./", "scope": "./", "display": "standalone",
    "background_color": "#f3f5f4", "theme_color": "#0b6b5d", "icons": [{"src": "icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any"}],
}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print("dist/index.html", len(glowa + fragment) // 1024, "kB", "· wersja", wersja)
