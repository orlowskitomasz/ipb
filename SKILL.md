---
name: indywidualny-plan-biegowy
description: Użyj przy /IPB albo gdy trzeba ułożyć lub sprawdzić indywidualny plan biegowy, dopisać uwagę do projektu IPB, albo budować otwartoźródłową aplikację IPB (wywiad, strefy, plan, testy, prognozy, mapy, zegarki, sejf na hasło).
---

# IPB – Indywidualny Plan Biegowy

IPB to otwartoźródłowa aplikacja z planem biegowym szytym na miarę. **Źródłem prawdy jest repozytorium IPB**: `docs/SPEC.md` (pełna specyfikacja), `docs/REJESTR.md` (uwagi i decyzje), `docs/FORMAT-PLANU.md`, `tests/`. Ten skill zawiera zasady i sposób pracy; wystarcza, żeby ułożyć i sprawdzić plan także bez repozytorium.

## 1. Co zrobić po wywołaniu

| Wywołanie | Działanie |
|---|---|
| `/IPB [obszar]: uwaga` | dopisz wpis do rejestru (niżej), oceń wpływ na reguły, popraw SPEC/skill/testy, zgłoś sprzeczność z zasadami |
| `/IPB plan` albo prośba o plan | wywiad → ocena celu → plan → **sprawdzenie R1–R16** → dopiero potem pokaż plan |
| `/IPB sprawdź` + plan | sprawdź plan walidatorem (R1–R22) i wypisz ustalenia według poziomu |
| `/IPB oceń` + plan z dowolnego źródła | przepisz plan do `plan.json`, wypisz, czego nie dało się odczytać, uruchom walidator, pokaż ustalenia według poziomu ze źródłem i pewnością |
| `/IPB testy` | uruchom `python3 tests/sprawdz_plan.py --self-test`, `python3 tests/test_plan.py`, `python3 tests/test_silnik.py`, `python3 tests/test_eksport.py`, `python3 tests/test_dziennik.py`, `python3 tests/test_trasy.py` i `python3 build.py && python3 tests/test_sejf.py && python3 tests/test_offline.py && python3 tests/test_mapa.py`, pokaż wynik |
| `/IPB dalej` | zbuduj pierwszy niezrobiony krok z `docs/PLAN-BUDOWY.md` według zasad z tego pliku, przetestuj, zapisz w repozytorium i pokaż działającą stronę |
| `/IPB stan` | pokaż tabelę z `docs/PLAN-BUDOWY.md`: co zrobione, co następne |
| `/IPB pytania`, `/IPB rejestr` | pokaż otwarte pytania / rejestr |
| `/IPB decyzja: pytanie = odpowiedź` | zamknij pytanie, wpisz decyzję |
| prośba o aplikację | pracuj w repozytorium według `docs/SPEC.md`, kolejność z sekcji 14; bez repozytorium – powiedz, że trzeba je najpierw założyć z pakietu startowego |

Obszary: `zasady`, `wywiad`, `strefy`, `prognozy`, `plan`, `przeciążenie`, `dieta`, `mapy`, `pogoda`, `zegarki`, `pdf`, `prywatność`, `serwer`, `testy`, `repo`, `inne`. Bez obszaru – dobierz sam. Autor uwagi to pseudonim (`pseudonim=Kuba`), domyślnie „autor”.

**Gdzie zapisać uwagę:** jest dostęp do repozytorium → `docs/REJESTR.md` + poprawka w `docs/SPEC.md` (i w `tests/`, gdy zmienia się reguła). Nie ma → dopisz do sekcji 7 tego skilla jako propozycję zmiany skilla i zaznacz „do przeniesienia do repozytorium”.

Zawsze kończ 1–2 linijkami: co jest założeniem, czego nie sprawdzono, jakie jest ryzyko.

## 2. Zasady nadrzędne

1. **Zdrowie przed planem.** Ból w klatce, kołatanie, omdlenie, nietypowa duszność, ból narastający w biegu, gorączka → przerwać, lekarz. Nie diagnozuj.
2. **Dane osobowe tylko w sejfie zaszyfrowanym hasłem użytkownika** (Argon2id + AES-GCM, kod odzyskiwania). Nie pytaj o imię, e-mail, telefon, adres; wystarcza rok urodzenia.
3. **Dane zostają u użytkownika.** Serwer synchronizacji trzyma tylko zaszyfrowane bloki, każdy użytkownik ma własny klucz.
4. **Żadnych przypadkowych zapytań.** Zamknięta, jawna lista serwerów (mapy, pogoda); bez analityki, bez filmów z zewnątrz.
5. **Pełna jawność.** Kod czytelny, każda formuła ze źródłem, licencja AGPL-3.0.
6. **Plan szyty na miarę, ale uczciwy.** Cel dowolny; zawsze pokaż, gdzie leży względem prognozy.
7. **Czas treningu z planu ma pierwszeństwo.** Jednostką jest czas; rozgrzewka kończy się automatycznie, nigdy przyciskiem LAP.
8. **Nie zmyślaj.** Możliwości zegarków i serwisów sprawdzaj; niepewne oznacz „do weryfikacji”.

## 3. Wywiad (minimum do planu)

Rok urodzenia, płeć, masa, wzrost · poziom (`zaczynam` / `regularnie` / `zaawansowany`) i osobno „wracam po przerwie/kontuzji” · obecne obciążenie (h i km na tydzień, najdłuższy bieg) · ile minut mieści się w każdym dniu tygodnia i które dni są wolne · rekordy z datami · HRmax i LTHR (zmierzone albo „nie wiem”) · progi z DFA alfa 1 (0,75 → próg tlenowy, 0,5 → próg mleczanowy), jeśli są · zegarek · cel: dystans z czasem **albo** czas biegu, z datą · cele pośrednie.

„Nie wiem” jest poprawną odpowiedzią: wtedy szacuj i zaplanuj test, który zastąpi szacunek pomiarem. Wynik wywiadu zapisz jako `profil.json`.

## 4. Jak ułożyć plan

- **Ocena celu:** prognoza dwiema metodami z ostatniego wyniku – Riegel (T2 = T1 × (D2/D1)^1,06) i VDOT (równania Danielsa i Gilberta; to wskaźnik wyniku, nie pomiar VO2max); podaj przedział, pewność i status `realny` / `ambitny` / `nierealny`. Przy nierealnym zaproponuj cel pośredni i układaj plan pod niego.
- **Fazy:** baza → rozwój → specyficzna → taper. Co 3.–4. tydzień lżejszy.
- **Tydzień:** dni ustawia użytkownik (wolne, akcent, długi, spokojny, siła); wypełniaj tylko resztę. Ryzykowny układ zostaw, ale ostrzeż i zaproponuj zamianę.
- **Jednostki:** spokojne i długie w minutach, akcenty na czas lub dystans odcinka. Spokojny bieg kończy się ok. 5 uderzeń poniżej progu tlenowego.
- **Biblioteka:** spokojny, regeneracyjny, długi (też z szybkim finiszem lub odcinkami w tempie startu), BNP, sub-próg, odcinki progowe, bieg progowy, piramida, VO2max, zmienne tempo, podbiegi, fartlek. Początkujący: marszobieg.
- **Uzupełnienia:** rozgrzewka dynamiczna przed akcentem (bez statycznego rozciągania), plyometria 1–2 × w tygodniu, siła 2 × 20–30 min, mobilność po biegu. Ćwiczenia jako animacje wbudowane w aplikację.
- **Bramki:** testy i starty pośrednie z progiem wyniku, po którym cel zostaje, spada albo rośnie.
- **Podpowiedzi „czegoś brakuje”:** brak długiego biegu, progu, szybkości, siły, dnia wolnego, testu; za dużo lub za mało intensywności; zbyt szybki wzrost. Podpowiadaj z powodem, nie zmieniaj planu samodzielnie.
- **Czytelność:** widok prosty (nazwa, czas, „spokojnie / mocno”, jedno zdanie „po co”) i szczegółowy (tempa, tętna, strefy). Żadnego skrótu bez wyjaśnienia.

Plan zapisz jako `plan.json` i pokaż jako tabelę tydzień po tygodniu.

### Format (skrót; pełny w `docs/FORMAT-PLANU.md`)
- `profil.json`: `poziom`, `powrot_po_przerwie`, `obciazenie.h_tydz`, `dni.{pn…nd}.max_min` (0 = zablokowany), `rekordy[{dystans_km, czas, data}]`, `hrmax`, `lthr`, `cel{typ: dystans|czas_biegu, …}`.
- `plan.json`: `ocena_celu{status, prognoza, uzasadnienie, cel_posredni}`, `bramki[]`, `tygodnie[{nr, start, faza, dni[7]}]`; dzień: `{dzien, typ, min, mocne_min, dodatki[], opis}`; `typ`: `wolne`, `spokojny`, `regeneracyjny`, `marszobieg`, `dlugi`, `akcent`, `test`, `start`.

## 5. Testy – każdy plan musi je przejść

Jest repozytorium i powłoka → `python3 tests/sprawdz_plan.py profil.json plan.json` i popraw plan, aż wynik to „PLAN OK”. Nie ma → przejdź listę ręcznie i napisz przy planie, które reguły sprawdziłeś.

| | Reguła |
|---|---|
| R1 | 7 dni pn…nd, znane typy, `mocne_min` ≤ `min`, „wolne” = 0 minut |
| R2 | dni zablokowane i limit minut dnia (zawody bez limitu) |
| R3 | akcent/test/start nie dzień po dniu; długi nie dzień po mocnym; mocny nie dzień po długim |
| R4 | długi ≤ 170 min; symulacja startu ≤ 180 min, najwyżej 2 |
| R5 | tydzień ≤ 110% najwyższego z 3 poprzednich (albo +15 min); start od obecnego obciążenia; start docelowy nie liczy się |
| R6 | w każdych 5 kolejnych tygodniach jeden lżejszy (≤ 88% poprzedniego) |
| R7 | mocne minuty ≤ 25% tygodnia (zawody nie liczą się) |
| R8 | początkujący: ≥ 2 dni wolne w tygodniu |
| R9 | początkujący: 8 tygodni bez akcentów; marszobieg w 1. tygodniu przy < 1,5 h/tydz. |
| R10 | powrót po przerwie: 2 tygodnie bez mocnych dni, 1. tydzień ≤ obecne obciążenie |
| R11 | brak HRmax/LTHR → test w tygodniach 1–4 (nie dla początkujących i powrotu) |
| R12 | cel > 7% szybszy od szybszej z dwóch prognoz (Riegel, VDOT) z ostatniego wyniku → „nierealny” + cel pośredni; 2–7% → co najmniej „ambitny” |
| R13 | ostatni tydzień zawiera start; od półmaratonu ostatni tydzień bez startu ≤ 70% szczytu |
| R14 | od półmaratonu: bramki + test/start kontrolny wcześniej niż 3 tyg. przed celem |
| R15 | od półmaratonu: długi bieg (lub start/test ≥ 90 min) co tydzień poza ostatnim |
| R16 | siła w ≥ 75% tygodni; plyometria nie dzień przed mocnym dniem, nie w tygodniu startu, u początkujących nie w tyg. 1–4 |
| R17 | każdy bieg (poza testem) ma cel: zakres tętna lub tempa; start z czasem docelowym ma tempo |
| R18 | siła w każdym tygodniu poza ostatnim |
| R19 | informacja: tydzień bez dnia wolnego |
| R20 | informacja: ostatni wynik starszy niż 6 miesięcy |
| R21 | każdy bieg ma podany cel („po co”) i miejsce w cyklu |
| R22 | informacja: rozkład czasu w strefach (opis układu, nie ocena) |
| R23 | trasa: długość równa treningowi; propozycja poza ±8% nie jest pokazywana |
| R24 | trasa: część główna (odcinki, test, tempo) z dala od skrzyżowań; rozgrzewka nigdy nie jest wydłużana |
| R25 | informacja: pogoda i zmierzch dla godzin biegu; nie zmienia planu |

**Poziomy ustaleń:** krytyczne (tylko R1 i R2: format i twarde ograniczenia zawodnika), istotne zastrzeżenie, uwaga, informacja. Plan z generatora nie może mieć ustaleń powyżej informacji. Pełny opis każdej reguły (klasa źródła A–D, źródło, pewność, korekta) jest w `src/reguly.js`; reguły wykonuje `src/walidator.js`, a `tests/sprawdz_plan.py` tylko go uruchamia.

**Jak mówić o ustaleniach:**
- „plan odbiega od reguły X (źródło, pewność)”, nigdy „ten trening spowoduje uraz”;
- heurystyk (wzrost 10%, 25% mocnych minut, limit 170 min) nie przedstawiaj jako praw fizjologii;
- nie podawaj jednej liczby „jakości planu” i nie obiecuj wyniku;
- gdy dane są oszacowane albo nieaktualne, powiedz to przy rekomendacji;
- obciążenie (punkty, średnie 7 i 42 dni, stosunek 7 do 28 dni) opisuje wykonaną pracę, nie ryzyko urazu ani adaptację; zmianę planu proponuj dopiero przy dwóch zgodnych sygnałach;
- objawy urazu lub choroby: nie diagnozuj, ogranicz obciążenie, odeślij do specjalisty, nie proponuj nadrabiania.

**Adaptacja planu (propozycja, nigdy cicha zmiana):** opuszczony trening – nie nadrabiaj, najwyżej zamień z dniem spokojnym, gdy był kluczowy; tydzień przerwy – wróć od ok. 70% ostatniego tygodnia, bez akcentów przez tydzień; lepszy wynik – wpisz go jako sprawdzian, intensywności zmienią się po przeliczeniu, nie po jednym udanym treningu; narastające zmęczenie – przy dwóch sygnałach zamień najbliższy akcent na spokojny bieg; mniej dni – zmień limity w wywiadzie i przelicz plan, kilometrów nie przenoś mechanicznie. Zawsze podaj: powód, dane, zakres, porównanie przed i po, wpływ na cykl, niepewność.

Biegacze testowi (`tests/profile/`, 11 profili): początkujący na czas i na 5 km, 10 km średnio zaawansowany, półmaraton przy 45 km, maratończyk 3:20 i zaawansowany, cel nierealny, powrót po kontuzji, nieregularny harmonogram, brak HRmax, brak historii. Po każdej zmianie reguł w skillu lub SPEC: popraw `tests/sprawdz_plan.py`, dodaj profil lub zepsuty plan, uruchom `--self-test`.

Testy aplikacji (sieć tylko do jawnej listy, sejf, FIT, PDF, offline, dwa języki) są opisane w `docs/SPEC.md` sekcja 16.2 i powstają razem z kodem.

## 5a. Metodyka (pełna baza: `docs/METODYKA.md`)

**Kolejność:** profil zawodnika → historia → oszacowanie formy → ocena celu → makrocykl → mikrocykl → dobór jednostek → walidacja → plan z ustaleniami i założeniami. Niczego nie zmyślaj: brak danej to szacunek oznaczony jako szacunek albo test w planie.

**Dane zawodnika:** każda wartość jest potwierdzona, oszacowana, nieaktualna (wynik starszy niż 6 miesięcy) albo jej brak. Im słabsze dane, tym niższa pewność rekomendacji – mów to przy planie.

**Metody i ich zakres:**
- VDOT (Daniels) – prognoza i tempa z aktualnego wyniku; wskaźnik wyniku, nie pomiar VO2max; tabel i planów z książki nie kopiuj.
- Riegel – druga prognoza; razem z VDOT daje przedział.
- Pfitzinger – tylko zasady ogólne przygotowań do półmaratonu i maratonu.
- Seiler – „większość spokojnie”; 80/20 to opis elity, nie wymóg; zawsze nazwij metodę liczenia rozkładu.
- Prędkość krytyczna – tempo odcinków z 2–3 prób; jeszcze nie w aplikacji.
- Banister – średnie 7 i 42 dni opisują wykonaną pracę, nie adaptację organizmu.
- Periodyzacja – baza, rozwój, faza pod start, taper (mniej objętości, ta sama intensywność i liczba treningów), okres przejściowy.
- Autoregulacja – zmiana planu dopiero przy dwóch zgodnych sygnałach.

Gdy metody dają różne wnioski, pokaż oba i powiedz, z jakich założeń wynika różnica. Nie łącz ich w jeden „uniwersalny” algorytm.

**Ograniczenia:** twarde (dni zablokowane, limity minut, przeciwwskazania, data startu) nigdy nie ustępują. Miękkie ustępują w kolejności: odstęp między mocnymi dniami, długi bieg, liczba akcentów, objętość. Każde ustępstwo nazwij.

**Źródła:** A dowody naukowe, B metodologia trenerska, C otwarty kod, D heurystyka projektu. Nie wymyślaj cytowań ani DOI. Źródło niepotwierdzone nazwij niepotwierdzonym.

**`/IPB porównaj` + dwa plany:** tabela różnic w wymiarach: czas tygodniowy, rozkład intensywności, długie biegi, jednostki specyficzne, periodyzacja, regeneracja, dopasowanie do zawodnika, założenia, kompromisy. Bez jednej liczby i bez założenia, że więcej kilometrów to lepiej.

**Kolejne kroki budowy** opieraj na tej bazie: każda liczba lub zalecenie pokazywane zawodnikowi ma regułę w `src/reguly.js` (klasa źródła, pewność) i test; eksport przenosi cel dnia i uzasadnienie, nie same minuty.

## 6. Praca nad aplikacją

- Repozytorium robocze: `github.com/orlowskitomasz/ipb` (kopia na Codeberg później). Kolejność i stan kroków: `docs/PLAN-BUDOWY.md`. Jeden plik `index.html` budowany z modułów; polski i angielski; zegarki: Garmin, Suunto, Coros, Apple Watch.
- Kolejność: sejf + wywiad + strefy + prognozy + plan → dziennik i import → eksport na zegarek i PDF → prywatność i PWA → mapy i pogoda → synchronizacja → pozostałe zegarki.
- Każda zmiana: test, wpis w historii wersji bez danych użytkownika, numer wersji w nazwie pliku.
- Punkt wyjścia: aplikacja referencyjna autora („Plan treningowy” 1.30) – przed publikacją usunąć z niej dane domyślne autora.
- Trasy: skill `planowanie-tras-biegowych`, jeśli dostępny.

## 7. Rejestr uwag (gdy nie ma dostępu do repozytorium)

Format: `RRRR-MM-DD · autor · obszar · uwaga · status`

- 2026-11-10 · autor · całość · Stan wyjściowy: decyzje z 10.11.2026 zapisane w `docs/REJESTR.md` (sejf na hasło z Argon2id, AGPL-3.0, Codeberg, wielu użytkowników serwera, PL + EN, 4 marki zegarków, cel na dystans lub czas, uzupełnienia jako animacje, 3 poziomy + powrót po przerwie, testy R1–R16) · przyjęte

### Otwarte pytania
- (brak)
