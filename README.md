# Stubin

Ett pusselspel i webbläsaren, inspirerat av Nintendos Game & Watch-spel Bomb Sweeper (1987).
Du knuffar väggar för att ta dig fram till en bomb innan stubinen brunnit ner.

- 120 banor i 10 världar: 100 symmetriska labyrinter och 20 rullande bossbanor
- Fasta pelare (värld 2), hål i golvet (värld 3) och glidande isblock (värld 6)
- Knuffrekord per bana med medalj, stjärnor efter tid kvar, arkadläge med tre försök
- All grafik och allt ljud skapas i koden, utan bildfiler eller ljudfiler

## Struktur

| Sökväg | Innehåll |
|---|---|
| `src/rules.js` | Spelreglerna, delade mellan spelet och bangeneratorn |
| `src/art.js` | Teman och ritfunktioner för block, figur och bomber |
| `src/game.js` | Spelmotor: tillstånd, animation och rendering |
| `src/ui.js` | Menyer, HUD, ljud, styrning och sparning |
| `src/template.html` | Sidans HTML och CSS |
| `gen/gen3.js` | Generator och optimal lösare för labyrinterna |
| `gen/boss.js` | Generator för bossbanorna |
| `gen/merge3.js` | Sätter ihop banorna till `gen/levels.json` och sätter tiderna |
| `gen/verify3.js` | Spelar upp varje lösning mot reglerna och kontrollerar rekord och symmetri |
| `build.js` | Bygger `dist/index.html`, en enda fristående fil |

## Bygga

```sh
node build.js            # skriver dist/index.html
```

## Generera banorna på nytt

```sh
cd gen
node gen3.js run 0 2 & node gen3.js run 1 2   # labyrinter, två processer (tar ungefär en timme)
node boss.js                                  # bossbanor
node merge3.js                                # skriver levels.json och solutions.json
node verify3.js                               # kontroll
cd .. && node build.js
```

## Testskript

`shot.js`, `keytest.js`, `holdtest.js`, `medaltest.js` och `feat.js` kör spelet i Chrome via Playwright och tar skärmbilder till `shots/`.
