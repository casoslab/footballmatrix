# footballmatrix

A tournament squad archive for 19 national teams: who was in the squad, at which tournament,
wearing which number — from the 1908 Olympic football tournament to the 2026 World Cup.

**16,242 squad entries · 8,880 players · 167 tournaments · 19 countries · 1908–2026**

(One squad entry is one player in one country's squad at one tournament. Counted per country
page — the way the source archive counts — the same data is 8,890 player rows.)

The site is static, has no analytics, sets no cookies, and makes no third-party request of any
kind. The dataset it renders is in this repository and can be used on its own.

## What is in here

| Path | What it is |
| --- | --- |
| `data/raw/html/` | The provenance archive: the original hand-built HTML pages this project started from. Read-only, never edited, never renamed. |
| `data/dist/` | The canonical dataset, generated from the archive. Normalised JSON: countries, tournaments, players, squad entries, plus per-country views. |
| `tools/py/` | `extract-from-html.py` (the one-time migration) and `verify-positions.py` (cross-checks positions against Wikipedia). |
| `tools/ts/` | The data validator and the path naming linter, both dependency-free. |
| `site/` | The Astro static site, English and Turkish. |
| `docs/` | The data model, the naming conventions, the design system. |

## Using the data

Everything in `data/dist/` is plain JSON with camelCase fields and kebab-case ids.

```jsonc
// players.json
{
  "id": "hakan-calhanoglu",
  "name": "Hakan Çalhanoğlu",
  "wikipediaTitle": "Hakan Çalhanoğlu",
  "wikipediaUrl": "https://en.wikipedia.org/wiki/Hakan_%C3%87alhano%C4%9Flu",
  "birthYear": 1994,
  "position": "MF",                  // null when the archive does not state one
  "positionConfidence": "confirmed"  // confirmed | disputed | unverified
}

// squad-entries.json — one row per (country, tournament, player)
{ "countryId": "turkiye", "tournamentId": "world-cup-2026", "playerId": "hakan-calhanoglu", "shirtNumber": 10 }
```

`data/dist/by-country/<country-id>.json` is a denormalised view: one country with its
tournaments, players and entries inlined, so a client can render a country page from one fetch.

Full field-by-field description, including where every value comes from in the source HTML:
[`docs/data-model.md`](docs/data-model.md).

## What this data does not know

This matters more than the totals, so it is stated up front rather than buried:

- **3,095 players have no position.** The source archive marks them `pos--`. They carry
  `position: null` and `positionConfidence: "unverified"`. They are not guessed. An earlier draft
  of the extractor filled them with a default value, which would have fabricated a third of the
  dataset; that is why the field is nullable.
- **460 players have a disputed position.** The archive says one thing, their Wikipedia infobox
  says another — usually because the player genuinely played several positions (Lothar Matthäus:
  midfielder and sweeper). Both readings are kept and both are shown.
- **401 players have no birth year.**
- **63 player links point at a Wikipedia search** rather than an article, and 16 rows are generic
  stand-by entries. They are given documented synthetic identities so unrelated rows do not merge.

`data/dist/reports/` carries the machine-readable versions of all of the above.

## Running it

```sh
# Regenerate the dataset from the HTML archive (needs Python 3, no dependencies)
python3 tools/py/extract-from-html.py

# Validate it: schema, referential integrity, and the golden counts that prove
# the extraction is lossless against the archive
node tools/ts/validate-data/validate-data.mjs

# Check that every path is kebab-case
node tools/ts/lint-naming/lint-naming.mjs

# Build the site
cd site && npm install && npm run build
```

`verify-positions.py` is the only thing here that touches the network. It re-checks every
player's position against Wikipedia and rewrites `data/dist/reports/position-mismatches.json`.
It is slow and rarely needed.

## Licences

Two, because the code and the data have different origins.

- **Code** — MIT. See [`LICENSE`](LICENSE).
- **Data** — CC BY-SA 4.0, inherited from Wikipedia. If you reuse it you must credit the source
  and share your derivative under the same terms. See [`LICENSE-DATA`](LICENSE-DATA) and
  [`ATTRIBUTION.md`](ATTRIBUTION.md), which lists all 167 source pages and the date each was
  retrieved.
- **Typefaces** — Newsreader, IBM Plex Sans and JetBrains Mono, all SIL OFL 1.1, bundled and
  served from this site rather than a CDN.

## Contributing

Corrections to the data are the most useful contribution. Open a pull request against
`data/dist/` with the Wikipedia source that supports the change. See
[`CONTRIBUTING.md`](CONTRIBUTING.md).
