# Data model

## Where data lives

| Path | Role |
|--- |--- |
| `data/raw/html/` | Provenance archive. The 20 hand-built HTML pages this project started from. Read-only; never edited, never renamed. |
| `data/dist/` | The canonical dataset, generated from `data/raw/html/`. Committed to the repo — this is what the site, the app and any consumer read. |
| `data/schema/` | JSON Schema for each entity. CI validates `data/dist/` against these. |

The extraction (`tools/py/extract-from-html.py`) is a **one-time migration**. Once
`data/dist/` exists and is verified lossless, it becomes the source of truth and
corrections are made there, by pull request, with a Wikipedia citation.

## Entities

```jsonc
// countries.json
{
  "id": "turkiye",                  // kebab-case slug, stable
  "nameTr": "Türkiye",
  "nameEn": "Turkey",
  "iso3": "TUR",
  "flagEmoji": "🇹🇷",
  "confederation": "UEFA",
  "theme": { "sky": "#d62f3c", "skySoft": "#fff0f1", "navy": "#711f2a", "gold": "#e9b84a" }
}

// tournaments.json
{
  "id": "world-cup-1954",
  "type": "world-cup",              // world-cup | continental | olympic
  "year": 1954,
  "nameTr": "Dünya Kupası",
  "nameEn": "FIFA World Cup",
  "sourceUrl": "https://en.wikipedia.org/wiki/1954_FIFA_World_Cup_squads",
  "retrievedAt": "2026-08-03"
}

// players.json
{
  "id": "hakan-calhanoglu",         // slug of wikipediaTitle
  "name": "Hakan Çalhanoğlu",
  "wikipediaTitle": "Hakan Çalhanoğlu",
  "wikipediaUrl": "https://en.wikipedia.org/wiki/Hakan_%C3%87alhano%C4%9Flu",
  "birthYear": 1994,                // null when the archive has no birth year
  "position": "MF",                 // GK | DF | MF | FW, or null when unknown
  "positionConfidence": "confirmed" // confirmed | disputed | unverified
}

// squad-entries.json — one row per (country, tournament, player)
{
  "countryId": "turkiye",
  "tournamentId": "world-cup-2026",
  "playerId": "hakan-calhanoglu",
  "shirtNumber": 10                 // null when the source shows no number
}
```

`data/dist/by-country/<country-id>.json` is a denormalised convenience view: one
country with its tournaments, players and entries inlined, so a client can render a
country page from a single fetch.

`data/dist/footballmatrix.sqlite` carries the same data in `countries`,
`tournaments`, `players` and `squad_entries` tables (snake_case columns), for the
mobile app and any future query layer.

## Where each field comes from

| Field | Source in the raw HTML |
|--- |--- |
| player name, wikipedia link | `tr[data-name] th.player a.player-link` |
| birth year | `td.meta.birth` |
| position | `span.position-badge.pos-(gk\|df\|mf\|fw)` |
| tournament type | `th.year` class: `world-cup` / `continental` / `olympic` |
| tournament name + year | `th.year button span` (name) and the text after it (year) |
| shirt number | the cell at the tournament's column index; `-` means "not in that squad" |
| squad size | the `counts` array in each page's inline `<script>` |
| source URL, retrieval date | the page footer |
| country theme colours | `<body style="--sky:…;--sky-soft:…;--navy:…;--gold:…">` |

## Position confidence

`tools/py/verify-positions.py` cross-checks every player's position against the
`positions` field of their English Wikipedia infobox and writes
`data/dist/reports/position-mismatches.json`. The current archive has **460**
mismatches out of 5,739 checkable players — mostly players whose Wikipedia entry
lists several positions (e.g. Lothar Matthäus: midfielder, sweeper).

| `positionConfidence` | Players | Meaning |
| --- | --- | --- |
| `confirmed` | 5,325 | The archive gives a position and Wikipedia does not contradict it. |
| `disputed` | 460 | Wikipedia's infobox disagrees with the archive's position. |
| `unverified` | 3,095 | The archive itself has no position (`pos--`); `position` is `null`. |

Neither gap is papered over. A missing position stays `null` — guessing one would
fabricate a third of the dataset — and disputes keep both readings, shown
transparently on the site's data quality page alongside the Wikipedia field that
caused the disagreement.

## Integrity rules (enforced by `tools/ts/validate-data`)

1. Every `squadEntry` references an existing country, tournament and player.
2. Every country has at least one tournament; every tournament at least one entry.
3. `id` values are unique and kebab-case.
4. Per-tournament entry counts match the `counts` array read from the raw HTML.
5. Golden totals hold: 8,890 player rows across 19 countries, 16,242 squad entries,
   167 distinct tournaments, 8,880 distinct players; Türkiye 216 players / 304 squad
   records / 14 tournaments; Brazil 902 rows / 75 tournament columns (23 World Cup,
   38 Copa América, 14 Olympic).

Any failure exits non-zero. The extraction is only accepted when it is provably
lossless against the archive.
