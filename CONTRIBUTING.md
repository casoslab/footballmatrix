# Contributing

## Correcting the data

This is the most useful thing you can do here. The dataset is transcribed from Wikipedia and it
has known gaps — see the "What this data does not know" section of the README.

1. Edit the relevant file in `data/dist/`. Do **not** edit `data/raw/html/`: that is the
   provenance archive and it is deliberately frozen, even where it is wrong.
2. Cite the Wikipedia page that supports your change in the pull request. A correction without a
   source cannot be reviewed.
3. Run the validator:

   ```sh
   node tools/ts/validate-data/validate-data.mjs
   ```

   It checks referential integrity and the golden counts that prove the dataset still matches the
   archive. If your change alters a count on purpose, say so — the golden values live in
   `validate-data.mjs` and may need updating along with an explanation.

**A missing value stays missing.** If the archive does not record a player's position, the right
change is not to pick a plausible one. `position: null` with `positionConfidence: "unverified"`
is the correct state, and a pull request that fills those in with guesses will be declined.

## Code

- Every path is kebab-case. `node tools/ts/lint-naming/lint-naming.mjs` enforces it, and CI runs
  it. See [`docs/naming-conventions.md`](docs/naming-conventions.md) for the per-layer rules
  (kebab-case files, camelCase JSON, snake_case SQL).
- The site's design is a system, not a set of preferences:
  [`docs/design-system.md`](docs/design-system.md). Colours, fonts, sizes, spacing and durations
  come from `site/tokens.css` by name. If you need a value that has no token, add a named token —
  do not inline it.
- No external requests. No analytics, no telemetry, no cookies, no font CDN, no third-party
  script. This is not negotiable: a CDN request hands every visitor's IP address to another
  party, which this project does not do.
- No invented numbers anywhere on any page. Every figure must trace back to `data/dist/`.

## Running the checks

```sh
python3 tools/py/extract-from-html.py        # regenerate; must be byte-identical
node tools/ts/validate-data/validate-data.mjs
node tools/ts/lint-naming/lint-naming.mjs
cd site && npm install && npm run build
```

The extraction is deterministic: running it twice must produce byte-identical files, and CI fails
if regenerating produces a diff.

## Adding a country

Out of scope for a drive-by pull request. The archive covers 19 countries and adding a twentieth
means extending the provenance archive itself, which is a different kind of change. Open an issue
first.

## Licensing your contribution

Code contributions are under MIT. Data contributions are under CC BY-SA 4.0, which is what
Wikipedia's licence requires of anything derived from it. Opening a pull request means you are
fine with that.
