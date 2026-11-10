# IPB – specyfikacja

Pełny opis aplikacji „Indywidualny Plan Biegowy”. Zmiany tylko przez wpis w `docs/REJESTR.md`. Numeracja sekcji zgodna ze skillem (`SKILL.md`).

---

## 1. Zasady nadrzędne (nie podlegają negocjacji bez wpisu w Rejestrze)

1. **Bezpieczeństwo użytkownika przed planem.** Objawy alarmowe (ból w klatce, kołatanie, omdlenie, nietypowa duszność, ból narastający w trakcie biegu, gorączka) → przerwać i lekarz. Aplikacja nie diagnozuje.
2. **Dane osobowe tylko w zaszyfrowanym sejfie.** Profil, wywiad, dziennik, pliki z zegarka, historia testów i postępów to dane osobowe (także o zdrowiu: tętno, HRV, masa). Zapisujemy je **wyłącznie zaszyfrowane hasłem użytkownika** (sekcja 11a), żeby mógł wracać do planu i śledzić postęp. Minimalizacja dalej obowiązuje: nie pytamy o imię, nazwisko, e-mail, telefon, adres; do wzorów wystarcza rok urodzenia (pełna data tylko z własnej woli).
3. **Dane zostają u użytkownika.** Sejf leży lokalnie (IndexedDB, opcjonalnie plik na dysku). Synchronizacja przesyła ten sam zaszyfrowany blok; serwer i jego administrator nie mają klucza. Konto na serwerze = losowy identyfikator, nie e-mail.
4. **Żadnych przypadkowych zapytań.** Lista domen zewnętrznych jest zamknięta, jawna i w CSP (sekcja 11). Każde połączenie ma wyłącznik w ustawieniach; bez internetu aplikacja działa w pełni poza mapami/pogodą.
5. **Pełna jawność.** Kod otwarty, czytelny, bez minifikacji w repozytorium, bez zaciemniania; każda formuła (strefy, prognozy, obciążenie) opisana w kodzie z odnośnikiem do źródła; w aplikacji ekran „Co i dokąd wysyłamy”.
6. **Plan szyty na miarę, ale uczciwy.** Użytkownik wybiera dowolny cel; aplikacja pokazuje, gdzie ten cel leży względem prognozy z badań, i ustawia bramki (testy pośrednie), które go weryfikują.
7. **Długość/czas treningu z planu ma pierwszeństwo** przed trasą, pogodą i wygodą. Rozgrzewka kończy się automatycznie (czas/dystans), nigdy przyciskiem LAP, i nigdy nie jest wydłużana.
8. **Nie zmyślamy.** Możliwości zegarków/API sprawdzamy przed obiecaniem; czego nie wiemy – oznaczamy jako „do weryfikacji”.

---

## 2. Architektura

- **Języki:** polski i angielski od pierwszego wydania; wszystkie teksty w `i18n/pl.json` i `i18n/en.json`, żadnych napisów w kodzie.
- **Front:** jeden plik `index.html` budowany z modułów `js/*.js` + `style.css` + bibliotek w `lib/` (wszystko wbudowane, bez CDN w czasie działania). Brak frameworka lub lekki, bez kroku kompilacji wymaganego do czytania kodu.
- **Tryby uruchomienia:**
  1. **plik lokalny** (`file://`) – pełny plan, dziennik, eksport; bez map i pogody;
  2. **dowolny serwer statyczny** (nginx, Apache, Caddy, GitHub/Codeberg Pages, Cloudflare Pages, Netlify) – + mapy, pogoda, instalacja jako PWA;
  3. **serwer + synchronizacja** – mały serwis `/__data` (Cloudflare Worker, Deno, Node lub PHP – implementacje referencyjne w repo) przechowujący **tylko zaszyfrowane bloki**, z logowaniem formularzem i ciasteczkiem `__Host-` (HMAC), wersjonowaniem (`If-Match` → 412 przy konflikcie) i kopiami dziennymi.
- **Service worker:** cache aplikacji (network-first dla HTML), **nie** obsługuje ścieżek `/__*` (logowanie/sync) – inaczej przeglądarka nie pokaże logowania.
- **HTTPS:** zawsze. Na własnym serwerze **Let's Encrypt** (Caddy robi to automatycznie; nginx/Apache + certbot); na hostingach statycznych certyfikat dostarcza platforma. HSTS, `Content-Security-Policy`, `Referrer-Policy: no-referrer`, `Permissions-Policy` (geolokalizacja tylko `self`).
- **Moduły** (każdy w osobnym pliku, z testem): `state` (dane + migracje), `interview`, `zones`, `predict`, `plan`, `library` (jednostki), `adapt` (opuszczone dni, choroba), `load` (przeciążenie), `diary`, `import` (FIT/TCX/GPX/CSV/ZIP), `fit-export`, `watch` (skrypty/instrukcje dla marek), `maps`, `routes`, `weather`, `pdf`, `sync`, `privacy`.

---

## 3. Wywiad początkowy

★ – obowiązkowe; reszta poprawia dokładność. Każde pole ma „nie wiem” → aplikacja szacuje i planuje test, który zastąpi szacunek pomiarem.

| Pole | Uwagi |
|---|---|
| ★ rok urodzenia | wystarczy rok; pełna data opcjonalnie (trafia tylko do sejfu) |
| ★ płeć | do wzorów (HRmax, prognozy); opcja „nie podaję” → wzory neutralne |
| ★ masa, ★ wzrost | masa do energii, mocy i paliwa |
| ★ obciążenie biegowe | średnio km i h/tydz. z 8–12 tyg., najdłuższy bieg, najwyższy tydzień w historii |
| ★ liczba biegów i innych treningów/tydz. | + siła, rower, pływanie |
| ★ dostępny czas | na każdy dzień tygodnia (np. „wt/czw max 60–70 min”), dni wolne, okresy z większą ilością czasu |
| ★ data ostatnich zawodów | + dystans, czas, warunki, czy „na maksa” |
| ★ rekordy życiowe | 5 km, 10 km, półmaraton, maraton (+ data – stare rekordy ważą mniej) |
| HRmax | zmierzony (test/zawody), nie wzór |
| LTHR | z testu 30 min (średnia z ostatnich 20 min) |
| tętno spoczynkowe | średnia poranna z 7 dni |
| progi HRV z DFA alfa 1 | **HRVT1** przy α1 = 0,75 (≈ próg tlenowy, LT1/VT1) i **HRVT2** przy α1 = 0,5 (≈ próg mleczanowy, LT2/VT2) – tętno i tempo. Uwaga: „alfa 2” (α2) to inny wykładnik DFA (długookresowy) i **nie** służy do wyznaczania progów |
| VO2max z zegarka, moc progowa | orientacyjnie |
| urządzenia i serwisy | zegarek (Garmin/Coros/Suunto/Apple Watch/inny), pas piersiowy, serwisy |
| kontuzje (2 lata), zgoda lekarza | tylko „tak/nie” i obszar, bez diagnoz |
| preferencje | pora biegania, teren, bieżnia, trasy (pętle, zieleń, mało skrzyżowań), dzień wolny |
| ★ cel główny | dowolny: **dystans** (5 km … maraton, ultra) z czasem A/B/C **albo czas biegu** (np. „30 min bez przerwy”, „2 h w górach”, bieg 6 h) + data |
| poziom | **3 poziomy**: zaczynam (marszobieg, cel na czas) / regularnie / zaawansowany – ustawia domyślny widok i ilość szczegółów (sekcja 6); dokładne obciążenie plan liczy z danych wywiadu, nie z poziomu. Osobno znacznik **„wracam po przerwie/kontuzji”** – łagodniejszy start niezależnie od poziomu |
| cele pośrednie | dowolne starty/testy po drodze |

---

## 4. Strefy – kilka modeli

Liczone równolegle i pokazane w jednej tabeli: % HRmax, Karvonen (rezerwa tętna), Friel (% LTHR), Daniels (VDOT – tempa E/M/T/I/R), Seiler/80-20 (3 strefy z LT1/LT2), model norweski (próg ~2–4 mmol przybliżony tętnem), DFA α1 (HRVT1/HRVT2), MAS/prędkość krytyczna.

Reguły:
- model domyślny = oparty na **pomiarach** (LTHR + HRVT1); gdy brak – Karvonen + VDOT, z planem testów;
- **E kończy się ~5 uderzeń poniżej LT1**, długi do LT1;
- zmiana progów dopiero po **2–3 zgodnych pomiarach**; pomiar DFA z biegu o wąskim zakresie tętna = ekstrapolacja → odrzucić; lepsze rampy i biegi o zmiennym tętnie;
- bieżnia z nachyleniem: moc z zegarka zaniżona → wykluczyć z analiz mocy;
- tempo maratońskie przed wynikiem kontrolnym kontrolowane tętnem.

---

## 5. Prognozy i realność celu

- Co najmniej dwie metody, wynik jako **przedział**:
  - Riegel: T2 = T1 × (D2/D1)^1,06 (maraton u amatorów raczej 1,07–1,08),
  - VDOT (Daniels),
  - Vickers & Vertosick (2016) – maraton z dwóch wyników i kilometrażu,
  - Tanda (2011) – tempo maratońskie z tygodniowego km i tempa treningowego (do weryfikacji współczynników przed implementacją).
- Spójność wyników (np. 10 km vs półmaraton) → diagnoza: brak wytrzymałości czy szybkości.
- Porównanie tempa celu z obecnym progiem (LT2): tempo maratońskie zwykle 3–6% wolniej niż próg. Cel ≈ obecny próg → cel ambitny, zależny od postępu.
- **Bramki decyzyjne**: progi wyników testów/startów pośrednich, po których cel zostaje, spada albo rośnie (np. 10 km ≤ X, test 30 min ≤ Y/km, półmaraton ≤ Z).
- Prognoza aktualizowana po każdym teście i co 4 tygodnie z danych treningowych.

---

## 6. Plan

- Fazy: **baza/sub-próg → rozwój (próg, VO2) → specyficzna → taper (2–3 tyg.)**; co 3.–4. tydzień lżejszy (−15–25%); wzrost tygodnia 5–10%.
- **Jednostka: czas.** E, R i długie w minutach (dystans wynika z tętna); akcenty na dystans lub czas odcinka; testy i starty na dystans. Tydzień w godzinach, km jako szacunek.
- **Długi max ~2:45–2:50 h** (do 3:00 h tylko 1–2 symulacje startu); szczyt jako **limit godzin** dopasowany do dostępnego czasu.
- 2 akcenty + długi; dzień spokojny po akcencie; dni z limitem czasu – skrócić rozgrzewkę/odcinki, nigdy tempo; dzień wolny – propozycja (zwłaszcza 40+), decyzja użytkownika; siła 2 × 20–30 min.
- Adaptacja: opuszczony dzień – bez nadrabiania; choroba – 1–2 dni powrotu na każdy dzień choroby; sygnały zmęczenia → akcent zamieniony na E.
- Każdy bieg oceniany (0–10) z komentarzem „co dalej”: zgodność czasu, strefy, rozkład tempa, dryf tętna, DFA α1 (jeśli jest).

### Układ tygodnia ustawiany przez użytkownika
- Użytkownik sam przypisuje dni: **dzień wolny**, akcent, długi, spokojny, siła, „dowolny”. Może przeciągać jednostki między dniami i zablokować dzień („nie biegam w środy”).
- Generator wypełnia tylko to, czego użytkownik nie ustawił, i nie przesuwa zablokowanych dni. Gdy układ łamie zasadę bezpieczeństwa (np. dwa akcenty dzień po dniu, długi dzień po akcencie), plan go **zostawia**, ale pokazuje ostrzeżenie z powodem i propozycją zamiany jednym kliknięciem.
- Cel jako czas biegu (np. 30 min bez przerwy): progresja w minutach, dla początkujących marsz-bieg (np. 1 min bieg / 2 min marsz → ciągły bieg).

### Uzupełnienia biegu (rozgrzewka, plyometria, rozciąganie)
- **Rozgrzewka dynamiczna** (5–10 min) przed akcentami i testami: skipy A/B/C, wieloskoki lekkie, wymachy, przebieżki. Rozciągania statycznego **nie** dawać przed szybkim biegiem.
- **Plyometria** 1–2 × w tygodniu, krótko (5–15 min), progresja od niskiej intensywności (skakanka, podskoki obunóż) do wyższej (wieloskoki, skoki jednonóż); nie przed akcentem następnego dnia, nie w tygodniu startu; początkujący dopiero po kilku tygodniach regularnego biegania.
- **Rozciąganie/mobilność** po biegu lub osobno (5–15 min): łydki, zginacze bioder, pośladki, tył uda; opcjonalnie rolowanie.
- **Siła** 2 × 20–30 min (już w planie wyżej).
- Każde ćwiczenie ma krótki opis i **animację** (SVG/CSS z repozytorium, wbudowaną w aplikację, działa offline; bez filmów i wideo z zewnętrznych serwisów – zasada 1.4). Uzupełnienia liczą się do czasu dnia, ale nie do kilometrażu.

### Podpowiedzi „czegoś brakuje”
Po każdej zmianie planu i co tydzień aplikacja sprawdza blok (ostatnie 2–4 tyg. + najbliższe) i pokazuje **podpowiedzi z powodem**, nigdy nie zmienia planu sama:
- brak długiego biegu przez > 10 dni (cel ≥ półmaraton);
- brak jednostki progowej/sub-progowej lub VO2max dłużej niż wymaga faza;
- brak przebieżek/szybkości w bazie; brak tempa startowego w fazie specyficznej;
- brak dnia wolnego lub lżejszego tygodnia od > 4 tyg.;
- za dużo intensywności (> ~20–25% czasu powyżej LT1) albo za mało (0% przez 3 tyg. przy celu na czas);
- skok objętości > 10% / ACWR wysoki (sekcja 7);
- brak siły, plyometrii lub mobilności przez > 2 tyg.;
- brak testu, a progi lub prognoza są starsze niż 6–8 tyg.;
- długi bieg dłuższy niż ~30% tygodnia lub > limit z sekcji 6.
Każda podpowiedź: co, dlaczego (1 zdanie), przycisk „dodaj w wolnym miejscu” albo „ignoruj na ten tydzień”.

### Czytelność dla każdego poziomu
- Dwa widoki tego samego planu: **prosty** (dzień: nazwa po polsku, czas, „spokojnie / mocno / bardzo mocno”, jedno zdanie „po co”) i **szczegółowy** (kroki, tempa, tętna, strefy, obciążenie). Domyślny wynika z poziomu, przełącznik zawsze widoczny.
- Bez skrótów bez wyjaśnienia: każdy skrót (E, R, L, BNP, LT1, VO2max) ma podpowiedź po dotknięciu i słowniczek.
- Kolory intensywności spójne w całej aplikacji i opisane legendą; nie tylko kolor (też ikona/słowo) – dostępność.
- Tydzień na jednym ekranie telefonu; łączny czas tygodnia na górze, km jako szacunek.

### Biblioteka jednostek
E (+ przebieżki), R, L, L z szybkim finiszem, L z odcinkami M, BNP (tercje E → M → nieco szybciej), sub-próg (np. 5 × 2 km), odcinki progowe (4–5 × 2 km / 60–90 s), bieg progowy ciągły, piramida (2-3-4-5-4-3-2 min), VO2max (np. 5 × 1000 m), zmienne tempo (n × 1 km M + 1 km luźniej), bieg w tempie startowym, podbiegi (krótkie i „kenijskie”), fartlek. Nowe formy **zamiast** istniejących akcentów, nie dodatkowo. Preferencje użytkownika wyłączają formy (np. „bez okrążeń w parku”).

### Testy pośrednie
MAS 6 min, test 30 min (LTHR), rampa HRVT1 z DFA, start kontrolny 5/10 km, półmaraton kontrolny 6–4 tyg. przed maratonem. Po teście: strefy → prognoza → bramki → jasna informacja dla użytkownika.

---

## 7. Przeciążenie – wskaźniki

Pokazywane razem, z jasnym „co zrobić”, bez straszenia jedną liczbą:
- obciążenie sesji: TRIMP (Banister) lub hrTSS; sRPE (czas × odczucie 1–10);
- **ATL/CTL/TSB** (7/42 dni) – forma i zmęczenie;
- **ACWR** (ostatnie 7 dni / średnia 28 dni) – sygnał, gdy > ~1,3–1,5 (dowody naukowe ograniczone – pokazywać jako orientacyjny);
- monotonia i obciążenie wg Fostera;
- poranne tętno spoczynkowe (+5 uderzeń vs 7-dniowa średnia) i ln rMSSD (spadek poniżej indywidualnej normy);
- dryf tętna (decoupling > 5% w biegach równych), DFA α1 przy stałym tempie niższe niż zwykle;
- ból/samopoczucie z dziennika.
Reakcja: 1 sygnał – uwaga; 2+ – akcent → E; utrzymujące się – lżejszy tydzień i propozycja konsultacji.

---

## 8. Dieta, regeneracja, planowanie dnia

Bilans energii bez restrykcji w szczycie; węglowodany 3–5 g/kg (dni lekkie), 6–8 g/kg (akcenty, długie), 8–10 g/kg (ładowanie); białko 1,6–2,0 g/kg; w biegu > 75 min 30–60 g węglowodanów/h (maraton trenować do 60–90 g/h); suplementy tylko z dowodami (kofeina, witamina D/żelazo po badaniu); sen 7–9 h; buty (wymiana ~600–800 km). Objawy zaburzeń odżywiania → bez liczb, propozycja specjalisty.

---

## 9. Mapy, trasy, pogoda

Pełne reguły i algorytmy: skill **planowanie-tras-biegowych** (jeśli dostępny). Skrót:
- długość = trening (±8%), jedna duża pętla, część główna z minimum skrzyżowań, zieleń, **2–3 przemyślane warianty** z „dlaczego”, bieżnia tylko w testach;
- start z **położenia telefonu** (za zgodą, nie zapisywane), zapas – zapisany punkt, ręcznie – przytrzymanie mapy; realny początek ≤ 1–1,5 km;
- dane: OSM przez Overpass (środek obszaru zaokrąglony do ~1 km, cache 30 dni, serwery zapasowe), routing **BRouter profil pieszy**; przejście na ulicy, wzdłuż której biegnie trasa, nie jest skrzyżowaniem biegacza;
- edycja jak w gpx.studio; pytanie „Dlaczego taka trasa?” po imporcie/edycji i nauka z odpowiedzi;
- pogoda: Open-Meteo dla godzin treningu, piktogramy, **źródło i godzina pobrania**, zmierzch liczony lokalnie;
- UI: mapa pod stałym nagłówkiem i paskiem zakładek, panel od dołu, pola dotyku ≥ 44 px, domyślnie dzień najbliższego biegu.

---

## 10. Pliki, zegarki, PDF

- **Import:** FIT (aktywności: tętno, R-R, moc, dynamika), TCX, GPX, CSV, ZIP z Garmin Connect; rozpoznanie bieżni (`sub_sport = treadmill`).
- **Eksport:** FIT treningów strukturalnych (kroki czas/dystans, cele tętna/tempa, rozgrzewka kończona automatycznie, krótkie nazwy), GPX tras, ICS kalendarza, XLSX danych.
- **Zegarki w pierwszym wydaniu: Garmin, Suunto, Coros, Apple Watch** (możliwości importu do weryfikacji przy każdej wersji):
  - Garmin – FIT + skrypt do Garmin Connect uruchamiany przez użytkownika w jego zalogowanej przeglądarce (bez przekazywania hasła), z podpisem treningu (`#plan <hash>`) do aktualizacji tylko zmienionych dni;
  - Coros, Suunto – treningi strukturalne przez ich aplikacje/serwisy lub pośredników; jeśli brak importu – czytelna rozpiska do ręcznego wpisania;
  - Apple Watch – treningi niestandardowe (WorkoutKit) przez aplikację pośredniczącą lub ręcznie;
  - pośrednicy: TrainingPeaks, intervals.icu, Runalyze, Strava – wskazać, co z czym się synchronizuje.
  Nigdy nie prosić o hasła i nie logować się w imieniu użytkownika.
- **PDF:** dziennik do druku (A4/A5, tydzień na stronę, pola na wykonanie); karta trasy (prawdziwy podkład OSM, cały trening na mapie, profil, tabela km, pogoda ze źródłem i godziną); karta treningu (kroki, tempa, tętna). Bez dzielenia bloków w połowie, nagłówki tabel powtarzane, bez przycisków.
- Przy udostępnianiu GPX/FIT: ostrzeżenie o starcie pod domem, numerze seryjnym zegarka i danych profilu; opcja przycięcia początku/końca trasy i usunięcia metadanych.

---

## 11a. Sejf danych (hasło użytkownika)

- **Pierwsze uruchomienie:** wywiad → użytkownik ustawia hasło (min. 12 znaków lub fraza; miernik siły liczony lokalnie). Bez hasła tylko podgląd demo, nic się nie zapisuje.
- **Szyfrowanie:** AES-GCM 256 (Web Crypto). Losowy klucz danych (DEK) „opakowany” kluczem z hasła wyprowadzonym przez **Argon2id** (biblioteka `hash-wasm`, licencja MIT, WASM wbudowany w plik JS → działa offline; wersja przypięta w `lib/`; parametry startowe m = 64 MiB, t = 3, p = 1 – do strojenia na słabszych telefonach), sól 16 B. Zapasowo, gdy WASM niedostępny: PBKDF2-SHA256 ≥ 600 000 iteracji; użyty algorytm i parametry zapisane w kopercie sejfu. Zmiana hasła = nowe opakowanie DEK, bez przeszyfrowania danych.
- **Kod odzyskiwania:** przy zakładaniu sejfu losowy kod (np. 24 słowa) do wydruku – drugie opakowanie DEK. Bez hasła i kodu danych **nie da się odzyskać**; aplikacja mówi to wprost.
- **Sesja:** klucz tylko w pamięci karty; blokada po bezczynności (domyślnie 15 min) i po zamknięciu. „Pamiętaj na tym urządzeniu” (nieeksportowalny klucz w IndexedDB) **istnieje**, domyślnie wyłączone; włączenie wymaga potwierdzenia ostrzeżenia, że każdy z dostępem do tego urządzenia/przeglądarki otworzy sejf (odpowiedzialność użytkownika).
- **W sejfie:** profil i wywiad, strefy z historią, plan, dziennik z ocenami, pliki FIT/GPX, punkt Start, testy, prognozy w czasie. Poza sejfem tylko ustawienia bez danych (język, motyw) i cache map/pogody (obszar, nie osoba).
- **Postęp:** każdy test, zmiana progów i prognozy zapisuje się z datą; ekran „Postęp” pokazuje wykresy w czasie (progi, prognoza, objętość, obciążenie).
- **Kilka osób na urządzeniu:** osobne sejfy i hasła; lista profili pokazuje tylko pseudonimy.
- **Serwer sync dla wielu osób:** każdy użytkownik ma własny losowy identyfikator i własne hasło sejfu; serwer trzyma osobne zaszyfrowane bloki i nie ma żadnego klucza. Wejście na serwer chroni dodatkowo kod zaproszenia/hasło serwera ustawiane przez administratora (chroni przed obcymi zapełniającymi serwer, nie służy do szyfrowania). Limit rozmiaru bloku i liczby kont.
- **Kopia:** plik `.ipb` = zaszyfrowany sejf (można trzymać w chmurze); eksport otwartym tekstem (JSON/CSV) tylko na wyraźne żądanie, z ostrzeżeniem.
- **Usunięcie:** „Usuń wszystko” kasuje sejf lokalnie i na serwerze sync.
- **RODO:** przy danych lokalnych administratorem jest sam użytkownik. Kto udostępnia serwer sync innym, trzyma tylko zaszyfrowane bloki, ale publikuje krótką informację: co trzyma, jak długo, jak usunąć.

## 11. Prywatność i bezpieczeństwo – lista kontrolna

- [ ] dane osobowe tylko w sejfie (11a); brak pól na imię, e-mail, telefon, adres; wymagany tylko rok urodzenia
- [ ] dane lokalnie; eksport/import zaszyfrowanej kopii przez użytkownika
- [ ] sync: ten sam sejf (AES-GCM 256, klucz z Argon2id; zapasowo PBKDF2-SHA256 ≥ 600 000 iteracji), sól i IV w kopercie; serwer przyjmuje tylko kopertę `{v, ct, iv, salt}`; wersjonowanie i 412 przy konflikcie; konto = losowy identyfikator
- [ ] logowanie formularzem, ciasteczko `__Host-…` HttpOnly Secure SameSite=Strict, HMAC, porównanie w stałym czasie; hasła tylko jako sekrety serwera
- [ ] CSP z zamkniętą listą: `connect-src 'self' https://brouter.de https://api.open-meteo.com https://overpass-api.de https://overpass.kumi.systems https://overpass.private.coffee`, `img-src 'self' data: blob: https://tile.openstreetmap.org` (lista w jednym miejscu kodu i na ekranie prywatności)
- [ ] do usług trafiają tylko współrzędne (obszar zaokrąglony tam, gdzie wystarcza); `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`
- [ ] geolokalizacja tylko na żądanie, nie zapisywana
- [ ] brak analityki, trackerów, ciasteczek poza logowaniem; brak CDN w czasie działania
- [ ] dziennik połączeń sieciowych widoczny w aplikacji (co, dokąd, kiedy)
- [ ] informacja RODO: jakie dane, gdzie, jak usunąć (przycisk „usuń wszystko”)
- [ ] testy sejfu: złe hasło, kod odzyskiwania, zmiana hasła, blokada po bezczynności, brak danych otwartym tekstem w IndexedDB/localStorage
- [ ] zależności przypięte do wersji, z sumami kontrolnymi; aktualizacje przez PR z przeglądem

---

## 12. Testy i jakość

- Playwright (Chromium) z **atrapami** wszystkich usług zewnętrznych (BRouter, Overpass, Open-Meteo, kafelki) – testy nie wychodzą do internetu.
- Testy jednostkowe formuł (strefy, prognozy, obciążenie) na znanych przykładach z literatury.
- Testy UI na telefonie (emulacja dotyku), trybu offline, eksportu FIT (walidacja struktury i CRC), PDF (wielostronicowość), sync (konflikt, złe hasło), CSP (żadnych połączeń poza listą).
- Każda zmiana: wpis w historii wersji (neutralny, bez danych użytkownika), numer wersji w nazwie pliku.

---

## 13. Repozytorium i licencja

- Repozytorium główne: **Codeberg** (niekomercyjne, Forgejo); **lustro na GitHubie** dla widoczności i zgłoszeń.
- Struktura: `js/`, `lib/` (przypięte biblioteki z licencjami), `style.css`, `build.py` (składa `index.html`), `server/` (sync: Worker/Deno/Node/PHP), `test/`, `docs/` (formuły ze źródłami, polityka prywatności), `SKILL.md` (ten plik), `CHANGELOG.md`, `SECURITY.md` (zgłaszanie podatności), `CONTRIBUTING.md`.
- Licencja: **AGPL-3.0-or-later** (kod), dokumentacja i schematy ćwiczeń CC BY-SA 4.0. Biblioteki zewnętrzne zachowują swoje licencje (Leaflet BSD-2, hash-wasm MIT – zgodne z AGPL). Mapy/dane: atrybucja © OpenStreetMap contributors (ODbL).
- Wydania: podpisane tagi, gotowy `index.html` jako artefakt wydania + suma SHA-256.

---

## 14. Kolejność budowy (MVP → pełna wersja)

1. `state` + **sejf (11a)** + `interview` + `zones` + `predict` + `plan` + `library` + układ tygodnia użytkownika + podpowiedzi „czegoś brakuje” + widok prosty/szczegółowy – plan w tabeli, offline.
1a. Uzupełnienia (rozgrzewka, plyometria, mobilność) z opisami i animacjami.
2. `diary` + `import` FIT/TCX + ocena biegu + `load`.
3. `fit-export` (Garmin) + ICS + PDF dziennika.
4. `privacy` (CSP, dziennik połączeń) + hosting statyczny + PWA.
5. `weather` + `maps` + `routes` + PDF trasy + GPX.
6. `sync` szyfrowany (wielu użytkowników) + serwer referencyjny.
7. `watch` – Suunto, Coros, Apple Watch (po weryfikacji możliwości).

Punkt wyjścia: istnieje działająca aplikacja referencyjna autora („Plan treningowy”, wersja 1.30), która realizuje większość modułów dla jednego biegacza. Przed publikacją trzeba z niej usunąć dane domyślne autora (cel, daty, tętna) i zamienić je na wywiad.

---

## 16. Testy – jak sprawdzić, że IPB działa

### 16.1 Testy planu (działają już teraz)
Każdy plan – z aplikacji albo wygenerowany przez asystenta ze skilla – zapisuje się jako `plan.json` (format: `docs/FORMAT-PLANU.md`) i sprawdza:

```
python3 tests/sprawdz_plan.py PROFIL.json PLAN.json
python3 tests/sprawdz_plan.py --self-test
```

`--self-test` sprawdza 5 biegaczy testowych (`tests/profile/`) z przykładowymi planami (`tests/przyklady/`) oraz 17 celowo zepsutych planów – każdy błąd musi zostać wykryty.

| Reguła | Co sprawdza |
|---|---|
| R1 | format: 7 dni pn…nd, znane typy, `mocne_min` ≤ `min`, „wolne” = 0 minut |
| R2 | dni zablokowane przez użytkownika i limit czasu dnia (zawody bez limitu) |
| R3 | dwa mocne dni (akcent, test, start) nie pod rząd; długi nie dzień po mocnym; mocny nie dzień po długim |
| R4 | długi ≤ 170 min; symulacja startu ≤ 180 min, najwyżej 2 w planie |
| R5 | tydzień ≤ 110% najwyższego z 3 poprzednich (albo +15 min); pierwsze tygodnie względem obecnego obciążenia |
| R6 | w każdych 5 kolejnych tygodniach jeden lżejszy (≤ 88% poprzedniego) |
| R7 | mocne minuty ≤ 25% czasu tygodnia (zawody nie liczą się) |
| R8 | początkujący: ≥ 2 dni wolne w tygodniu |
| R9 | początkujący: bez akcentów przez 8 tygodni; marszobieg w 1. tygodniu przy obciążeniu < 1,5 h/tydz. |
| R10 | powrót po przerwie: 2 tygodnie bez mocnych dni, 1. tydzień ≤ obecne obciążenie |
| R11 | brak HRmax/LTHR → test w tygodniach 1–4 (nie dotyczy początkujących i powrotu) |
| R12 | uczciwa ocena celu: cel > 7% szybszy od prognozy Riegla → „nierealny” + cel pośredni; 2–7% → co najmniej „ambitny” |
| R13 | ostatni tydzień zawiera start; od półmaratonu taper: ostatni tydzień (bez startu) ≤ 70% szczytu |
| R14 | od półmaratonu: bramki decyzyjne i test/start kontrolny wcześniej niż 3 tyg. przed celem |
| R15 | od półmaratonu: długi bieg (lub start/test ≥ 90 min) w każdym tygodniu poza ostatnim |
| R16 | siła w ≥ 75% tygodni; plyometria nie dzień przed mocnym dniem, nie w tygodniu startu, u początkujących nie w tyg. 1–4 |

Progi (110%, 88%, 25%, 7%, 70%) są wartościami wyjściowymi – zmiana wymaga wpisu w `docs/REJESTR.md` i poprawki w `tests/sprawdz_plan.py`.

Biegacze testowi: `poczatkujacy-30min`, `maraton-320`, `nierealny-cel`, `powrot-po-kontuzji`, `brak-hrmax`. Nowa reguła = nowy profil lub nowa mutacja w self-teście.

### 16.2 Testy aplikacji (do napisania razem z aplikacją)
- sieć: żadnego połączenia poza listą z sekcji 11 (Playwright z atrapami, test pada przy obcej domenie);
- sejf: brak danych otwartym tekstem w IndexedDB/localStorage, złe hasło nie otwiera, kod odzyskiwania działa, blokada po bezczynności;
- plan z aplikacji dla 5 profili testowych przechodzi `tests/sprawdz_plan.py`;
- eksport FIT: poprawna struktura i CRC; PDF: wiele stron bez uciętych bloków;
- tryb offline: aplikacja startuje i pokazuje plan bez sieci;
- dwa języki: brak brakujących kluczy w `i18n/pl.json` i `i18n/en.json`.
