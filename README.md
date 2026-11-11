# IPB – Indywidualny Plan Biegowy

Otwartoźródłowa aplikacja z planem biegowym szytym na miarę: wywiad, strefy, plan, testy, prognozy, wskaźniki przeciążenia, mapy, pogoda, zegarki, PDF. Dane użytkownika tylko w sejfie zaszyfrowanym jego hasłem. Działa offline i na dowolnym serwerze.

**Stan: krok 4 z 9** (`docs/PLAN-BUDOWY.md`). Działa wywiad, sejf na hasło, ocena celu, układanie planu tydzień po tygodniu, strefy i tempa, wpisywanie wyników testów, własny układ dni z ostrzeżeniami i podpowiedziami, dziennik z importem FIT/TCX/GPX, ocena biegu i obciążenie (`dist/index.html` – otwórz w przeglądarce, działa bez internetu). Jeszcze nie ma: eksportu na zegarek, map, pogody, PDF, synchronizacji, wersji angielskiej.

## Co jest w środku

| Plik | Po co |
|---|---|
| `SKILL.md` | skill dla Claude'a: zasady, sposób pracy, polecenie `/IPB` |
| `docs/SPEC.md` | pełna specyfikacja (sekcje 1–16) |
| `docs/REJESTR.md` | rejestr uwag i decyzji |
| `docs/PLAN-BUDOWY.md` | co jest zrobione i co jest następne |
| `docs/METODYKA.md` | baza metodyki: metody, ich zakres, źródła i ograniczenia |
| `docs/FORMAT-PLANU.md` | format `profil.json` i `plan.json` |
| `tests/sprawdz_plan.py` | sprawdza plan względem reguł R1–R16 |
| `tests/profile/` | 5 biegaczy testowych |
| `tests/przyklady/` | przykładowe plany, które przechodzą testy |
| `tests/test_plan.py` | sprawdza generator planu z aplikacji na 5 profilach i losowych |
| `tests/test_sejf.py` | test aplikacji w przeglądarce |
| `src/`, `build.py`, `dist/index.html` | kod aplikacji, składanie i gotowa strona |

## Uruchomienie testów

Wystarczy Python 3, bez instalowania czegokolwiek:

```
python3 tests/sprawdz_plan.py --self-test        # reguły planu
python3 tests/test_plan.py                       # generator z aplikacji (wymaga node)
python3 tests/test_dziennik.py                   # pliki z zegarka, ocena biegu, obciążenie (wymaga node)
python3 tests/test_silnik.py                     # rejestr reguł, VDOT, prognoza, status danych (wymaga node)
python3 tests/test_eksport.py                    # kalendarz ICS i trening FIT (wymaga node)
python3 build.py && python3 tests/test_sejf.py   # aplikacja w przeglądarce (wymaga playwright)
python3 tests/test_offline.py                    # praca bez internetu po pierwszym otwarciu (wymaga playwright)
python3 tests/sprawdz_plan.py tests/profile/maraton-320.json tests/przyklady/maraton-320.plan.json
```

## Zgłaszanie uwag

Z Claude'em: `/IPB [obszar]: uwaga`. Bez Claude'a: zgłoszenie w repozytorium albo wpis w `docs/REJESTR.md`.

## Licencja

Kod: AGPL-3.0-or-later (plik `LICENSE`). Dokumentacja: CC BY-SA 4.0.
