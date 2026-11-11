# Jak wystawić IPB w internecie

IPB to trzy pliki statyczne z katalogu `dist/`: `index.html`, `sw.js`,
`manifest.webmanifest` (plus `icon.svg`). Nie ma serwera aplikacji, bazy ani
kont. Dane biegacza zostają w jego przeglądarce, zaszyfrowane hasłem.

Wymagania: dowolny serwer plików statycznych i **HTTPS** (bez HTTPS
przeglądarka nie włączy szyfrowania ani pracy bez internetu).

## 1. Zbuduj

    python3 build.py        # tworzy dist/

## 2a. Własny serwer – Caddy (najprościej, certyfikat Let's Encrypt sam)

    # /etc/caddy/Caddyfile
    bieganie.example.org {
        root * /var/www/ipb
        file_server
        header {
            Strict-Transport-Security "max-age=31536000"
            X-Content-Type-Options "nosniff"
            Referrer-Policy "no-referrer"
            X-Frame-Options "DENY"
            Permissions-Policy "geolocation=(), camera=(), microphone=()"
        }
        header /sw.js Cache-Control "no-cache"
        header /index.html Cache-Control "no-cache"
    }

Skopiuj `dist/*` do `/var/www/ipb` i wykonaj `systemctl reload caddy`.
Caddy sam pobiera i odnawia certyfikat Let's Encrypt.

## 2b. Własny serwer – nginx + certbot

    server {
        listen 443 ssl http2;
        server_name bieganie.example.org;
        root /var/www/ipb;
        add_header Strict-Transport-Security "max-age=31536000" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer" always;
        add_header X-Frame-Options "DENY" always;
        location = /sw.js      { add_header Cache-Control "no-cache"; }
        location = /index.html { add_header Cache-Control "no-cache"; }
    }

Certyfikat: `certbot --nginx -d bieganie.example.org` (odnawia się sam).

## 2c. Gotowy hosting plików statycznych

Codeberg Pages, GitHub Pages, Cloudflare Pages i podobne: wskaż katalog
`dist/` jako katalog strony. HTTPS jest w cenie. Uwaga: operator takiego
hostingu widzi adresy IP odwiedzających (jak każdy serwer) – danych z sejfu
nie widzi, bo nigdy nie opuszczają przeglądarki.

## 3. Sprawdź po wdrożeniu

1. Strona otwiera się po `https://`, w ustawieniach widać „Praca bez
   internetu: gotowe”.
2. Wyłącz sieć i odśwież – strona nadal działa.
3. W narzędziach przeglądarki, zakładka „Sieć”: poza własną domeną nie ma
   żadnych połączeń (polityka CSP w `index.html` i tak by je zablokowała).

## 4. Aktualizacja

Podmień pliki z `dist/`. Service worker ma w nazwie skrót treści strony,
więc nowa wersja wczyta się przy następnym otwarciu z siecią. Sejf w
przeglądarce zostaje nietknięty.

## Czego nie robić

- Nie wyłączaj ani nie luzuj nagłówka CSP.
- Nie dodawaj statystyk odwiedzin, czcionek ani skryptów z zewnątrz.
- Nie włączaj logowania pełnych adresów z parametrami, jeśli nie musisz –
  IPB nie wkłada danych do adresu, ale to dobra praktyka.
