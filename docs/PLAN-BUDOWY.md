# IPB – plan budowy

Jedna lista: co jest zrobione, co jest następne i po czym poznać, że krok jest gotowy.
`/IPB dalej` buduje pierwszy niezrobiony krok. `/IPB stan` pokazuje tę listę.

Krok jest gotowy dopiero wtedy, gdy: działa w `dist/index.html`, ma test w `tests/`, wszystkie testy przechodzą, a zmiana jest zapisana w repozytorium i odnotowana tutaj.

| Nr | Krok | Stan | Gotowe, gdy |
|---|---|---|---|
| 1 | Sejf na hasło, wywiad, ocena celu, plan tydzień po tygodniu | **zrobione** (0.3) | – |
| 2 | Strefy i tempa: tętno i tempo dla każdego treningu, kilka modeli stref obok siebie, wynik testu zmienia strefy i prognozę | **zrobione** (0.4) | – |
| 3 | Własny układ tygodnia: przestawianie i blokowanie dni, podpowiedzi „czegoś brakuje” | **zrobione** (0.5) | – |
| 4 | Dziennik: wpisanie biegu ręcznie, import FIT/TCX/GPX, ocena biegu 0–10, wskaźniki przeciążenia, ekran „Postęp” | następny | plik z zegarka trafia do sejfu; widać plan kontra wykonanie; przeciążenie daje jasne „co zrobić” |
| 5 | Na zegarek i do druku: FIT treningu, skrypt do Garmin Connect, kalendarz ICS, PDF dziennika i treningu | czeka | trening z planu otwiera się na zegarku Garmin; PDF tygodnia mieści się na stronie |
| 6 | Do wystawienia w internecie: praca offline (PWA), ekran „Co i dokąd wysyłamy”, wersja angielska, instrukcja hostingu z Let's Encrypt | czeka | strona działa bez sieci po pierwszym otwarciu; wszystkie napisy w dwóch językach |
| 7 | Mapy, trasy, pogoda, PDF trasy | czeka | 2–3 trasy o długości treningu od położenia telefonu; połączenia tylko z listy w SPEC 11 |
| 8 | Synchronizacja między urządzeniami dla wielu użytkowników | czeka | serwer trzyma tylko zaszyfrowane bloki; konflikt wersji nie gubi danych |
| 9 | Suunto, Coros, Apple Watch; animacje ćwiczeń | czeka | po sprawdzeniu, co każda marka faktycznie przyjmuje |

## Zasady pracy nad krokiem
1. Przeczytaj odpowiednią sekcję `docs/SPEC.md` i wpisy w `docs/REJESTR.md`.
2. Uruchom wszystkie testy przed zmianą (README).
3. Buduj najmniejszą wersję, która spełnia kolumnę „Gotowe, gdy”.
4. Dodaj test, uruchom wszystkie, zbuduj `dist/index.html`.
5. Zmień stan w tej tabeli, zapisz w repozytorium, pokaż użytkownikowi działającą stronę.
