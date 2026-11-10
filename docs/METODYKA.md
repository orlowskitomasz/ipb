# IPB – baza metodyki

Na tej bazie opiera się skill `/IPB` i każdy krok budowy aplikacji. Reguły wykonywalne są w `src/reguly.js` i `src/walidator.js`; tutaj jest wiedza, z której wynikają. Źródła podane jako autor, rok, czasopismo; pozycje niepotwierdzone mają w rejestrze `potwierdzone: false`.

Klasy źródeł: **A** dowody naukowe · **B** uznana metodologia trenerska · **C** algorytm z otwartego kodu · **D** heurystyka projektu. Klasa mówi o pochodzeniu, nie o jakości.

## 1. Kolejność pracy silnika

Profil zawodnika → analiza historii → oszacowanie formy → ocena celu → makrocykl → mikrocykl → dobór jednostek → walidacja → plan z listą ustaleń i założeń.

Żaden krok nie zmyśla danych. Brak danej = szacunek oznaczony jako szacunek albo test w planie.

## 2. Model zawodnika

| Poziom personalizacji | Minimalne dane | Co wtedy potrafi silnik |
|---|---|---|
| 0 – ogólny | cel, data, dni i limity minut, obecne godziny na tydzień | plan na czas z tętnem szacowanym z wieku; pewność niska |
| 1 – z wynikiem | + jeden wynik z datą z ostatnich 6 miesięcy | prognoza dwiema metodami, tempa, ocena celu; pewność średnia |
| 2 – z pomiarem | + tętno progowe z testu, tętno maksymalne | strefy z pomiaru; pewność wysoka dla celów tętna |
| 3 – z historią | + dziennik z co najmniej 3 tygodni | obciążenie, plan a wykonanie, adaptacja |
| 4 – z danymi porannymi | + odczucie, sen, tętno spoczynkowe, zmienność tętna | autoregulacja z dwóch zgodnych sygnałów |

Status każdej danej: potwierdzona, oszacowana, nieaktualna (wynik starszy niż 6 miesięcy), brak. Status trafia do pewności rekomendacji.

## 3. Biblioteka metod

### Daniels / VDOT (B)
- **Cel:** prognoza czasu na innym dystansie; tempa E, M, T, I, R.
- **Podstawy:** równania Danielsa i Gilberta 1979 (koszt tlenowy prędkości, udział VO2max w funkcji czasu wysiłku).
- **Dane:** jeden aktualny wynik od ok. 3 km wzwyż.
- **Algorytm:** `src/prognoza.js` (`vdot`, `czasVdot`, `tempoPrzy`). Tempa jako ułamki VDOT: E 62–74%, T 84–88%, I 95–100%.
- **Zastosowanie:** tempo jako kotwica planu, gdy jest świeży wynik.
- **Ograniczenia:** to wskaźnik wyniku, nie pomiar VO2max; u wolniejszych biegaczy i w maratonie zawyża możliwości. Tabel i planów z książki nie kopiujemy.
- **Konflikty:** ze strefami z tętna progowego (inne zakresy u tej samej osoby) – pokazujemy oba, plan wskazuje kotwicę.
- **Pewność:** średnia.

### Riegel (A/B)
- **Cel:** szybka prognoza między zbliżonymi dystansami. T2 = T1 × (D2/D1)^1,06 (Riegel 1981).
- **Ograniczenia:** wykładnik z rekordów; amatorzy w maratonie wypadają gorzej (Vickers i Vertosick 2016).
- **Zastosowanie:** druga metoda prognozy; wynik zawsze jako przedział z VDOT. **Pewność:** średnia do półmaratonu, niska dla maratonu amatorów.

### Pfitzinger (B)
- **Cel:** budowa przygotowań do półmaratonu i maratonu: długi bieg, średnio długi bieg, bloki w tempie maratonu, tygodnie szczytowe, taper.
- **Zastosowanie w IPB:** tylko zasady ogólne (długi bieg co tydzień – R15, specyfika pod koniec). Autorskich rozpisek nie kopiujemy.
- **Ograniczenia:** zakłada wysoką objętość i 5–7 dni biegania. **Pewność:** średnia.

### Seiler i rozkład intensywności (A)
- **Cel:** proporcje spokojnego i mocnego biegania.
- **Podstawy:** obserwacje elity (Seiler i Kjerland 2006; Seiler 2010), kilka badań z losowaniem (Stöggl i Sperlich 2014).
- **Reguły:** model 3-strefowy (poniżej progu tlenowego, między progami, powyżej progu mleczanowego). Układy: spolaryzowany, piramidalny, progowy.
- **Ograniczenia:** 80/20 to opis elity, nie wymóg. Wynik zależy od metody liczenia (czas w strefie albo cel sesji) – metoda musi być nazwana.
- **Zastosowanie w IPB:** R7 (heurystyka 25%) i R22 (opis układu, bez oceny). **Pewność:** średnia dla „większość spokojnie”, niska dla wyższości jednego układu.

### Prędkość krytyczna (A)
- **Cel:** granica między wysiłkiem ciężkim i bardzo ciężkim; tempo odcinków.
- **Dane:** dwie lub trzy próby maksymalne po 2–20 minut. Model liniowy dystans–czas.
- **Ograniczenia:** wrażliwa na jakość prób; przy dwóch próbach brak miary błędu; wiarygodna dla ok. 1500–5000 m.
- **Stan:** nie wdrożona (P2). **Pewność:** średnia przy dobrych próbach.

### Banister – forma i zmęczenie (A model, D stałe)
- **Cel:** opis trendu obciążenia; w pełnej wersji prognoza formy.
- **Ograniczenia:** stałe czasowe są indywidualne; bez regularnych testów modelu nie da się dopasować.
- **Zastosowanie w IPB:** średnie wykładnicze 7 i 42 dni jako **opis wykonanej pracy**, nie adaptacji. **Pewność:** niska jako prognoza.

### Periodyzacja (B; taper A)
- **Reguły:** baza → rozwój → faza pod start → taper → okres przejściowy. Tydzień lżejszy co 3–4 (R6).
- **Taper (Bosquet i in. 2007):** mniej objętości, ta sama intensywność i liczba treningów. W IPB: maraton 3 tygodnie, półmaraton 2, krócej 1.
- **Ograniczenia:** dla długości faz dowodów jest mało. **Pewność:** taper wysoka, reszta średnia.

### Autoregulacja (A dla pomiaru obciążenia, B dla decyzji)
- **Dane:** odczucie po biegu (Foster i in. 2001), sen, samopoczucie, trend tętna, zmienność tętna.
- **Reguła:** pojedynczy sygnał nie zmienia planu. Zmiana jest proponowana przy dwóch zgodnych sygnałach.
- **Pewność:** średnia.

## 4. Ograniczenia twarde i miękkie

- **Twarde:** dni zablokowane, limity minut, przeciwwskazania podane przez zawodnika, data startu. Nie wolno ich naruszyć dla lepszego wyniku planu (R1, R2 – jedyne ustalenia krytyczne).
- **Miękkie:** proporcje intensywności, tempo wzrostu, długość faz, położenie długiego biegu.
- **Kolejność ustępstw:** odstęp między mocnymi dniami → długi bieg → liczba akcentów → objętość. Każde ustępstwo trafia do założeń planu.

## 5. Obciążenie

| Wskaźnik | Wzór | Dane | Kalibracja | Interpretacja | Gdy brak danych |
|---|---|---|---|---|---|
| Obciążenie biegu (pkt) | minuty/60 × intensywność² × 100 | czas; tętno albo odczucie | intensywność = tętno / tętno progowe | godzina na progu = 100 pkt | z odczucia: 0,5 + 0,05 × odczucie (D); bez niczego 0,75 |
| Obciążenie z odczucia | minuty × odczucie 1–10 | czas, odczucie | brak | porównywalne tylko u tej samej osoby | nie liczone |
| Zmęczenie / forma | średnia wykładnicza 7 / 42 dni | dzienne obciążenie | stałe umowne, nie indywidualne | trend wykonanej pracy | „za mało danych” poniżej 3 tygodni |
| Stosunek 7 do 28 dni | suma 7 dni / (suma 28 dni / 4) | jak wyżej | brak | opis zmiany obciążenia | nie liczone poniżej 3 tygodni |

Żaden z tych wskaźników nie diagnozuje urazu ani przetrenowania (krytyka stosunku ostrego do przewlekłego: Impellizzeri i in. 2020). Aplikacja pokazuje je bez progów i bez języka ryzyka.

## 6. Adaptacja planu

Każda adaptacja to propozycja z: powodem, danymi, zakresem, porównaniem przed i po, wpływem na cykl, niepewnością.

| Scenariusz | Postępowanie |
|---|---|
| A – opuszczony trening | Nie nadrabiać. Jeśli był kluczowy (długi bieg, jedyny akcent), zamienić z najbliższym spokojnym dniem, zachowując R3 |
| B – tydzień przerwy | Powrót od ok. 70% ostatniego tygodnia, tydzień bez akcentów; przy przerwie z powodu choroby ostrożniej |
| C – wzrost formy | Wynik wpisać jako sprawdzian; intensywności zmieniają się po przeliczeniu. Jeden udany trening nie zmienia planu |
| D – narastające zmęczenie | Przy dwóch zgodnych sygnałach najbliższy akcent → spokojny bieg; przy utrzymywaniu się – lżejszy tydzień |
| E – mniej dni | Zmienić limity w wywiadzie i przeliczyć; zachować długi bieg i jeden akcent, kilometrów nie przenosić mechanicznie |
| F – objawy urazu lub choroby | Nie diagnozować. Ograniczyć obciążenie, odesłać do specjalisty, nie nadrabiać |

## 7. Porównywanie planów

Wymiary: czas tygodniowy, kilometraż (szacunek), rozkład intensywności, długie biegi, jednostki specyficzne, periodyzacja, regeneracja, dopasowanie do zawodnika, założenia metodologiczne, kompromisy. Więcej kilometrów nie znaczy lepiej. Wynik to tabela różnic, nie jedna liczba.

## 8. Jak baza wpływa na kolejne kroki budowy

Każdy nowy moduł, który podaje zawodnikowi liczbę albo zalecenie, musi: wskazać regułę lub metodę z tej bazy, dopisać ją do `src/reguly.js` z klasą źródła i pewnością, mieć test. Eksport na zegarek i do kalendarza przenosi cel dnia (tętno lub tempo) i uzasadnienie („po co”), nie same minuty.
