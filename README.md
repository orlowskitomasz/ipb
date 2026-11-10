# IPB – Indywidualny Plan Biegowy

Otwartoźródłowa aplikacja z planem biegowym szytym na miarę: wywiad, strefy, plan, testy, prognozy, wskaźniki przeciążenia, mapy, pogoda, zegarki, PDF. Dane użytkownika tylko w sejfie zaszyfrowanym jego hasłem. Działa offline i na dowolnym serwerze.

**Stan: pakiet startowy.** Jest specyfikacja, format planu i działające testy planu. Kodu aplikacji jeszcze tu nie ma.

## Co jest w środku

| Plik | Po co |
|---|---|
| `SKILL.md` | skill dla Claude'a: zasady, sposób pracy, polecenie `/IPB` |
| `docs/SPEC.md` | pełna specyfikacja (sekcje 1–16) |
| `docs/REJESTR.md` | rejestr uwag i decyzji |
| `docs/FORMAT-PLANU.md` | format `profil.json` i `plan.json` |
| `tests/sprawdz_plan.py` | sprawdza plan względem reguł R1–R16 |
| `tests/profile/` | 5 biegaczy testowych |
| `tests/przyklady/` | przykładowe plany, które przechodzą testy |
| `tests/zbuduj_przyklady.py` | odtwarza przykładowe plany (to nie jest silnik planu) |

## Uruchomienie testów

Wystarczy Python 3, bez instalowania czegokolwiek:

```
python3 tests/sprawdz_plan.py --self-test
python3 tests/sprawdz_plan.py tests/profile/maraton-320.json tests/przyklady/maraton-320.plan.json
```

## Zgłaszanie uwag

Z Claude'em: `/IPB [obszar]: uwaga`. Bez Claude'a: zgłoszenie w repozytorium albo wpis w `docs/REJESTR.md`.

## Licencja

Kod: AGPL-3.0-or-later (plik `LICENSE`). Dokumentacja: CC BY-SA 4.0.
