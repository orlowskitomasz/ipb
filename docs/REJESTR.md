# IPB – rejestr uwag i decyzji

Format wpisu: `RRRR-MM-DD · autor (pseudonim) · obszar · uwaga · status (nowe / przyjęte / odrzucone + powód)`

- 2026-11-10 · autor · całość · Skill roboczy IPB: bezpieczeństwo, otwarte źródła, czytelny kod, brak danych osobowych, brak przypadkowych zapytań, pełna jawność, kod w otwartym repozytorium, Let's Encrypt, dowolny serwer i praca offline · nowe
- 2026-11-10 · autor · wywiad · data urodzenia, płeć, masa, wzrost, obciążenie, liczba treningów, data ostatnich zawodów, rekordy, HRmax, LTHR, progi alfa 1 (i „alfa 2” – wyjaśnione w sekcji 3) · nowe
- 2026-11-10 · autor · plan · program szyty na miarę, ale osadzony w badaniach o możliwym wyniku; dowolny cel + cele pośrednie · nowe
- 2026-11-10 · autor · moduły · mapy, pogoda, wgrywanie i eksport na zegarki różnych marek, PDF trasy i treningu, prognozy, wskaźniki przeciążenia · nowe
- 2026-11-10 · autor · prywatność · Aplikacja może zawierać dane osobowe, ale chronione hasłem, żeby użytkownik mógł wracać do planu i śledzić postępy → zasada 1.2 zmieniona z „brak danych osobowych” na „dane osobowe tylko w zaszyfrowanym sejfie”, dodana sekcja 11a · przyjęte
- 2026-11-10 · autor · inne · Szybki format dopisywania uwag (sekcja 0) · przyjęte
- 2026-11-10 · autor · decyzje · Argon2id (hash-wasm, MIT, offline) zamiast PBKDF2; „pamiętaj na tym urządzeniu” zostaje (ryzyko po stronie użytkownika); licencja AGPL-3.0-or-later; Codeberg + lustro GitHub; zegarki: Garmin, Suunto, Coros, Apple; języki PL + EN; serwer sync: wielu użytkowników, każdy z własnym kluczem · przyjęte
- 2026-11-10 · autor · serwer · Potwierdzone: serwer sync dla wielu użytkowników, każdy z własnym kluczem · przyjęte
- 2026-11-10 · autor · decyzje · Ćwiczenia jako animacje wbudowane w aplikację (bez filmów z zewnątrz); 3 poziomy + znacznik „wracam po przerwie/kontuzji” · przyjęte
- 2026-11-10 · autor · plan + wywiad · Cel jako dystans albo czas biegu; uzupełnienia: rozgrzewka, plyometria, rozciąganie; dowolny układ dni (jednostki i dni wolne); podpowiedzi, czego brakuje w planie; plan przejrzysty dla początkujących i zaawansowanych → sekcja 3 (cel, poziom), sekcja 6 (układ tygodnia, uzupełnienia, podpowiedzi, czytelność), sekcja 14 · przyjęte
- 2026-11-10 · autor · repo · Źródłem prawdy jest repozytorium: specyfikacja w `docs/SPEC.md`, rejestr w tym pliku, skill skrócony do zasad i sposobu pracy; dalsza budowa w nowym projekcie · przyjęte
- 2026-11-10 · autor · testy · Testy planu: 5 biegaczy testowych, reguły R1–R16, `tests/sprawdz_plan.py` z self-testem (SPEC sekcja 16) · przyjęte
- 2026-11-10 · autor · plan · Krok 1 zbudowany: sejf na hasło, wywiad, ocena celu, generator planu (`src/plan.js`) i jego widok prosty/szczegółowy; generator sprawdzany regułami R1–R16 na 5 profilach i losowych · przyjęte
- 2026-11-10 · autor · testy · R5: minuty startu docelowego w ostatnim tygodniu nie liczą się do wzrostu (tak jak w R2 i R7) · przyjęte
- 2026-11-10 · autor · strefy · Krok 2 zbudowany: strefy (% tętna maks., Karvonen, Friel) i tempa z ostatniego wyniku, cel tętna/tempa przy każdym biegu, wpisywanie wyników testów przelicza strefy, prognozę i plan bez przesuwania tygodni; reguła R17 · przyjęte
- 2026-11-10 · autor · prognozy · Prognoza liczy się z ostatniego wyniku (najnowsza data), nie z najlepszego – sprawdzian ma zmieniać prognozę w obie strony · przyjęte
- 2026-11-10 · autor · plan · Krok 3 zbudowany: zamiana dwóch dni w tygodniu, odpuszczenie biegu, cofnięcie zmian; ostrzeżenia (mocne dni pod rząd, długi obok mocnego, bieg ponad limit dnia, skoki przed akcentem) i podpowiedzi (brak długiego, siły, testu, dnia wolnego, za dużo mocnego); ręczne zmiany przetrwają przeliczenie planu · przyjęte
- 2026-11-10 · autor · dziennik · Krok 4 zbudowany: dziennik (ręcznie i z plików FIT/TCX/GPX), ocena biegu 0–10 (połowa za czas, połowa za intensywność), obciążenie (minuty × intensywność², godzina na progu = 100 pkt), zmęczenie/forma/stosunek 7 do 28 dni z radą, plan a wykonanie · przyjęte
- 2026-11-10 · autor · prywatność · Z pliku z zegarka zapisujemy tylko datę, czas, dystans, tętno i mocne minuty; współrzędne, przebieg i numer zegarka nie trafiają do sejfu. Sam plik nie jest przechowywany · przyjęte
- 2026-11-10 · autor · zasady · Audyt i rozbudowa silnika treningowego według załączonego planu pracy (14 etapów): faza 1 – raport; faza 2 – wdrożenie P0 i części P1 (SPEC sekcja 17) · przyjęte
- 2026-11-10 · autor · decyzje · Jeden walidator w JavaScript; własna implementacja zamiast kopiowania cudzego kodu; stosunek 7 do 28 dni bez progów i bez języka ryzyka; ocena biegu w trzech poziomach zamiast 0–10; silnik przed krokiem 5 · przyjęte
- 2026-11-10 · autor · prognozy · Druga metoda prognozy: VDOT z równań Danielsa i Gilberta; prognoza jako przedział; tempa stref z ułamków VDOT zamiast ekstrapolacji Riegla · przyjęte

## Otwarte pytania
- silnik: źródła oznaczone `potwierdzone: false` w `src/reguly.js` trzeba otworzyć i sprawdzić (autor, rok, wniosek) – kto i kiedy?
- dziennik: czy przechowywać całe pliki z zegarka (potrzebne do DFA alfa 1 i map), czy zostać przy samym podsumowaniu?
- podpowiedzi: przycisk „dodaj w wolnym miejscu” przy podpowiedzi nie jest zrobiony – potrzebny, czy wystarczy samo wskazanie?
- strefy: brakujące tętno maks. szacujemy wzorem Tanaki (208 − 0,7 × wiek), a próg jako 90% maks. – czy zostawić, czy bez pomiaru podawać tylko tempo i odczucie?
- strefy: model Danielsa (VDOT) i progi z DFA alfa 1 nie są jeszcze w aplikacji – dodać w kroku 4 razem z importem plików?
