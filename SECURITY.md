# Security

## Attack surface

This project is a static site and a JSON dataset. There is no server, no database, no user
account, no form, no cookie, and no third-party script. The build runs on committed data.

That leaves a small surface, mostly in the build tooling:

- `tools/py/verify-positions.py` makes outbound HTTPS requests to Wikipedia and parses the
  response. It is the only network-touching code here.
- `tools/py/extract-from-html.py` parses local HTML from `data/raw/html/`.
- The Astro build renders committed JSON into HTML.

## Reporting

Open a private security advisory through GitHub's *Security → Report a vulnerability* on this
repository. If that is unavailable to you, open a normal issue describing the class of problem
without a working exploit, and say that you have details to share privately.

There is no bug bounty.

## What counts as a vulnerability here

- Any way the build turns dataset content into executable script in the published pages
  (the dataset contains player names with apostrophes and non-Latin characters, and it is
  rendered into HTML on every page).
- Any way a crafted `data/dist/` file makes the tooling write outside the repository.
- Any external request the published site makes. The site is meant to make none; one appearing
  is a defect worth reporting.

## What does not

- Wrong or missing squad data. That is a data-quality issue — open a normal issue or a pull
  request with a Wikipedia source. See [`CONTRIBUTING.md`](CONTRIBUTING.md).
- Missing security headers on a mirror or fork you host yourself.
