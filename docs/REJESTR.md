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
- 2026-11-12 · autor · plan · Szybka zmiana jednostki („Zmień dzień”): krócej/dłużej ±5/±10 min, lżej (akcent → spokojny), przesuń na inny dzień, zamień typ; trening jako trzy klocki (rozgrzewka czasowa | część główna | schłodzenie) zmieniane przyciskami; rozgrzewka przy skracaniu nie zmienia się; walidator na żywo z plakietką reguły, porównanie przed → po, Cofnij; zmiana nigdy nie jest blokowana, tylko opisana → SPEC sekcja 6 „Szybka zmiana dnia” · przyjęte
- 2026-11-12 · autor · zegarki · Eksport jednym przyciskiem: „Wyślij tydzień” (ZIP z FIT na 7 dni, okno udostępniania telefonu), rozgrzewka zawsze jako krok czasowy, w opisie kroku cel dnia; kod QR z komputera na telefon (w wersji offline – do weryfikacji, bo wymaga przesłania pliku); natywnie WorkoutKit (Apple) i Garmin Training API (program partnerski – do weryfikacji) → SPEC sekcja 10 · przyjęte
- 2026-11-12 · autor · prognozy · Panel celu na żywo: przedział prognozy obok celu i status realny/ambitny/nierealny; osobno „z wyniku” (Riegel + VDOT, pewność maleje z wiekiem wyniku) i „z treningów” (tempo przy stałym tętnie w E, dryf tętna w L, odcinki względem planu – orientacyjnie); wykres trendu z bramkami; suwak „co jeśli” celu; zmiana celu lub temp tylko jako propozycja przy dwóch zgodnych sygnałach → SPEC sekcja 5 · przyjęte

## Otwarte pytania
- (brak – nowe pytania dopisywać tutaj)
