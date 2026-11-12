# Format profilu i planu

Dwa pliki JSON. Wspólny format dla aplikacji, dla planów pisanych przez asystenta ze skilla i dla testów (`tests/sprawdz_plan.py`).

## profil.json – wynik wywiadu

```json
{
  "id": "maraton-320",
  "rok_urodzenia": 1984, "plec": "m", "masa_kg": 76, "wzrost_cm": 180,
  "poziom": "regularnie",
  "powrot_po_przerwie": false,
  "obciazenie": {"h_tydz": 5.5, "km_tydz": 55, "najdluzszy_min": 120},
  "dni": {"pn": {"max_min": 0}, "wt": {"max_min": 70}, "sr": {"max_min": 60},
          "czw": {"max_min": 70}, "pt": {"max_min": 45}, "sob": {"max_min": 75}, "nd": {"max_min": 180}},
  "rekordy": [{"dystans_km": 10, "czas": "0:43:30", "data": "2026-09-20"}],
  "hrmax": 186, "lthr": 168,
  "start_planu": "2026-11-16",
  "cel": {"typ": "dystans", "dystans_km": 42.195, "czas": "3:20:00", "data": "2027-04-11"}
}
```

- `poziom`: `zaczynam` | `regularnie` | `zaawansowany`.
- `dni.*.max_min`: ile minut biegu mieści się w danym dniu; `0` = dzień zablokowany (wolny).
- `hrmax`, `lthr`: `null`, gdy nie zmierzone.
- `cel.typ`: `dystans` (z `dystans_km`, opcjonalnie `czas`) albo `czas_biegu` (z `minuty`).
- Bez imienia, e-maila, adresu. Wystarcza rok urodzenia.

## plan.json

```json
{
  "profil": "maraton-320",
  "ocena_celu": {"status": "ambitny", "prognoza": "3:20:06",
                 "uzasadnienie": "…", "cel_posredni": null},
  "bramki": [{"tydzien": 8, "opis": "10 km", "prog": "≤ 43:00 – cel zostaje"}],
  "tygodnie": [
    {"nr": 1, "start": "2026-11-16", "faza": "baza", "dni": [
      {"dzien": "pn", "typ": "wolne", "min": 0, "mocne_min": 0, "dodatki": []},
      {"dzien": "wt", "typ": "akcent", "min": 46, "mocne_min": 18,
       "dodatki": ["rozgrzewka", "plyometria", "mobilnosc"], "opis": "5 × 1 km w tempie progu"}
    ]}
  ]
}
```

- `ocena_celu.status`: `realny` | `ambitny` | `nierealny`. Przy `nierealny` obowiązkowy `cel_posredni` (ten sam kształt co `cel`) – plan jest wtedy budowany pod cel pośredni.
- `tygodnie[].dni`: zawsze 7 dni w kolejności `pn, wt, sr, czw, pt, sob, nd`.
- `typ`: `wolne`, `spokojny`, `regeneracyjny`, `marszobieg`, `dlugi`, `akcent`, `test`, `start`.
- `min`: minuty biegu łącznie z rozgrzewką i schłodzeniem. `mocne_min`: minuty powyżej progu tlenowego (LT1).
- `dodatki`: `rozgrzewka`, `plyometria`, `sila`, `mobilnosc` – nie liczą się do `min`.
- `symulacja: true` na długim biegu = symulacja startu (limit 180 zamiast 170 min).
- `opis`: dowolny tekst dla biegacza (kroki, tempa, tętna).
- `po_co`, `dlaczego_teraz`, `latwiej`: cel fizjologiczny, miejsce w cyklu, wariant prostszy (R21).
- `rodzaj`: `lekki`, `regeneracja`, `subprog`, `prog`, `vo2`, `cel`, `doprogu`; `mocne_strefa`: 2 (okolice progu) albo 3 (powyżej progu).
- `interwaly`: `{n, praca_s | praca_m, przerwa_s | przerwa_m}` – struktura odcinków dla zegarka i kalendarza.
- `cel_tetno`: `{od, do}` w uderzeniach na minutę (jedno z pól może nie wystąpić: samo `do` = „do X”, samo `od` = „powyżej X”).
- `cel_tempo`: `{od, do}` w sekundach na kilometr, `od` to szybszy koniec.
- `szacunek: true`: tętno wyliczone z szacunku (brak pomiaru), nie z testu.
- `plan.strefy`: `{hrmax: {v, szacunek}, lthr: {v, szacunek}}` – progi użyte przy układaniu planu.
- W profilu opcjonalnie `hr_spocz` (tętno spoczynkowe) i `start_planu` (pierwszy poniedziałek planu).
