# Naming conventions

Every path in this repository is **kebab-case**. This is enforced in CI by
`tools/ts/lint-naming/lint-naming.mjs`; a violation fails the build.

## Paths

- Directories and files: lowercase ASCII, words separated by `-`.
- No Turkish characters, spaces, underscores or camelCase in any path.
- One dot in a filename, separating name and extension (`player-table.tsx`),
  except for well-known compound extensions (`.d.ts`, `.config.js`, `.test.ts`).
- Dotfiles (`.gitignore`, `.github/`) follow the same rule after the leading dot.

## Inside files

| Layer | Rule | Example |
|--- |--- |--- |
| TypeScript / TSX file | kebab-case file, PascalCase export | `player-table.tsx` → `export function PlayerTable` |
| TS variables / functions | camelCase | `squadEntriesByCountry` |
| TS types / interfaces | PascalCase | `SquadEntry` |
| Python entry scripts | kebab-case (`.py` run directly, never imported) | `extract-from-html.py` |
| Python importable modules | snake_case (import statements cannot use `-`) | `wiki_export.py` |
| Data identifiers (`id`, slug) | kebab-case | `turkiye`, `world-cup-1954`, `euro-2024` |
| JSON field names | camelCase | `birthYear`, `shirtNumber` |
| SQLite tables / columns | snake_case | `squad_entries.shirt_number` |
| CSS classes / custom properties | kebab-case | `.position-badge`, `--sky-soft` |

## Deliberate exceptions

- `data/raw/html/*.html` keeps its original filenames. These are a provenance
  archive of the pages this project was built from; renaming them would break the
  link between extracted data and its source. The names are historically accurate
  even though they are misleading (`*-dunya-kupasi-kadrolari.html` also contains
  continental and Olympic squads) — that inaccuracy is resolved in the data layer,
  not by renaming the archive.
- Files whose names are fixed by an external tool or convention (`README.md`,
  `LICENSE`, `CODE_OF_CONDUCT.md`, `Makefile`, `package.json`) are allowed.

## Running the check

```sh
node tools/ts/lint-naming/lint-naming.mjs
```

Exit code `0` = clean, `1` = violations printed to stdout.
