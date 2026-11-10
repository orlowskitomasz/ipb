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
            .replace("/*JS*/", "\n".join(czytaj(f"src/{m}.js") for m in ("sejf", "prognoza", "app"))))

# Krok 1 nie łączy się z niczym: connect-src 'none'. Lista z docs/SPEC.md sekcja 11 dojdzie z mapami i pogodą.
CSP = ("default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; "
       "img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'")
glowa = ('<!doctype html>\n<html lang="pl">\n<head>\n<meta charset="utf-8">\n'
         '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
         f'<meta http-equiv="Content-Security-Policy" content="{CSP}">\n'
         '<meta name="referrer" content="no-referrer">\n')

(R / "dist").mkdir(exist_ok=True)
(R / "dist/fragment.html").write_text(fragment, encoding="utf-8")
naglowek, tresc = fragment.split("</style>\n", 1)          # <title> i <style> do <head>, reszta do <body>
(R / "dist/index.html").write_text(glowa + naglowek + "</style>\n</head>\n<body>\n" + tresc + "\n</body>\n</html>\n", encoding="utf-8")
print("dist/index.html", len(glowa + fragment) // 1024, "kB")
