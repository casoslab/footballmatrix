#!/usr/bin/env python3
"""Migrate the local HTML provenance archive into canonical JSON data."""

from __future__ import annotations

import html
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit


ROOT = Path(__file__).resolve().parents[2]
RAW_HTML = ROOT / "data" / "raw" / "html"
DIST = ROOT / "data" / "dist"
REPORTS = DIST / "reports"
PAGE_SUFFIX = "-dunya-kupasi-kadrolari.html"

COUNTRY_METADATA = {
    "almanya": ("Germany", "DEU", "UEFA"),
    "arjantin": ("Argentina", "ARG", "CONMEBOL"),
    "belcika": ("Belgium", "BEL", "UEFA"),
    "brezilya": ("Brazil", "BRA", "CONMEBOL"),
    "danimarka": ("Denmark", "DNK", "UEFA"),
    "fransa": ("France", "FRA", "UEFA"),
    "hollanda": ("Netherlands", "NLD", "UEFA"),
    "ingiltere": ("England", "ENG", "UEFA"),
    "ispanya": ("Spain", "ESP", "UEFA"),
    "isvec": ("Sweden", "SWE", "UEFA"),
    "italya": ("Italy", "ITA", "UEFA"),
    "kamerun": ("Cameroon", "CMR", "CAF"),
    "kolombiya": ("Colombia", "COL", "CONMEBOL"),
    "meksika": ("Mexico", "MEX", "CONCACAF"),
    "nijerya": ("Nigeria", "NGA", "CAF"),
    "portekiz": ("Portugal", "PRT", "UEFA"),
    "rusya": ("Russia", "RUS", "UEFA"),
    "turkiye": ("Turkey", "TUR", "UEFA"),
    "uruguay": ("Uruguay", "URY", "CONMEBOL"),
}

CONTINENTAL_METADATA = {
    "Avrupa Şampiyonası": ("euro", "UEFA European Championship"),
    "Copa América": ("copa-america", "Copa América"),
    "Afrika Uluslar Kupası": ("afcon", "Africa Cup of Nations"),
    "CONCACAF Gold Cup": ("gold-cup", "CONCACAF Gold Cup"),
    "CONCACAF Şampiyonası": ("concacaf-championship", "CONCACAF Championship"),
}

EXTRA_TRANSLITERATION = str.maketrans({
    "Æ": "AE", "æ": "ae", "Ð": "D", "ð": "d", "Đ": "D", "đ": "d",
    "Ə": "E", "ə": "e", "ı": "i", "Ł": "L", "ł": "l", "Ø": "O",
    "ø": "o", "Œ": "OE", "œ": "oe", "ß": "ss", "Þ": "Th", "þ": "th",
    "Ƶ": "Z", "ƶ": "z", "Ħ": "H", "ħ": "h", "Ŋ": "N", "ŋ": "n",
})


def fail(message):
    raise ValueError(message)


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    rendered = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    path.write_text(rendered, encoding="utf-8")


def plain_text(value):
    return html.unescape(re.sub(r"<[^>]+>", "", value)).strip()


def slug(value):
    translated = unicodedata.normalize("NFKD", value.translate(EXTRA_TRANSLITERATION))
    ascii_value = "".join(character for character in translated if not unicodedata.combining(character))
    ascii_value = ascii_value.encode("ascii", "ignore").decode("ascii").casefold()
    result = re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")
    return result or "player"


def country_options():
    source = (RAW_HTML / "index.html").read_text(encoding="utf-8")
    options = {}
    pattern = re.compile(r'<option value="([^\"]+' + re.escape(PAGE_SUFFIX) + r')">([^<]+)</option>')
    for filename, label in pattern.findall(source):
        country_id = filename.removesuffix(PAGE_SUFFIX)
        match = re.fullmatch(r"(\S+)\s+(.+)", html.unescape(label).strip())
        if not match:
            fail(f"index.html: cannot parse country option {label!r}")
        options[country_id] = (match.group(2), match.group(1))
    if set(options) != set(COUNTRY_METADATA):
        fail("index.html country options do not match the hand-written country metadata")
    return options


def parse_theme(source, page_name):
    match = re.search(r'<body style="([^\"]+)">', source)
    if not match:
        fail(f"{page_name}: body theme is missing")
    properties = dict(re.findall(r"--([a-z-]+):([^;\"]+)", match.group(1)))
    required = ("sky", "sky-soft", "navy", "gold")
    if any(key not in properties for key in required):
        fail(f"{page_name}: incomplete body theme")
    return {
        "sky": properties["sky"],
        "skySoft": properties["sky-soft"],
        "navy": properties["navy"],
        "gold": properties["gold"],
    }


def parse_counts(source, page_name):
    match = re.search(r"const counts = (\[.*?\]);", source, re.S)
    if not match:
        fail(f"{page_name}: counts array is missing")
    counts = json.loads(match.group(1))
    if not all(isinstance(item, list) and len(item) == 2 and isinstance(item[1], int) for item in counts):
        fail(f"{page_name}: invalid counts array")
    return counts


def parse_source_links(source):
    links = {}
    pattern = re.compile(r'<a href="(https://en\.wikipedia\.org/wiki/[^"]+)"[^>]*>(.*?)</a>', re.S)
    for raw_url, raw_label in pattern.findall(source):
        label = plain_text(raw_label).replace(" · ", " ", 1)
        if re.fullmatch(r"\d{4}(?:-[IV]+)? .+", label):
            links[label] = html.unescape(raw_url)
    return links


def parse_tournament(header_type, name_tr, year_label, source_url, retrieved_at, confederation):
    year_match = re.fullmatch(r"(\d{4})(?:-(I|II))?", year_label)
    if not year_match:
        fail(f"invalid tournament year label: {year_label}")
    year = int(year_match.group(1))
    edition = {None: None, "I": "1", "II": "2"}[year_match.group(2)]

    if header_type == "world-cup":
        tournament_id = f"world-cup-{year}"
        name_en = "FIFA World Cup"
        tournament_type = "world-cup"
    elif header_type == "olympic":
        tournament_id = f"olympics-{year}"
        name_en = "Summer Olympics men's football tournament"
        tournament_type = "olympic"
    elif header_type == "continental":
        if name_tr not in CONTINENTAL_METADATA:
            fail(f"unknown continental tournament: {name_tr}")
        prefix, name_en = CONTINENTAL_METADATA[name_tr]
        expected_confederation = {
            "Avrupa Şampiyonası": "UEFA",
            "Copa América": "CONMEBOL",
            "Afrika Uluslar Kupası": "CAF",
            "CONCACAF Gold Cup": "CONCACAF",
            "CONCACAF Şampiyonası": "CONCACAF",
        }[name_tr]
        if confederation != expected_confederation:
            fail(f"{name_tr} is inconsistent with confederation {confederation}")
        tournament_id = f"{prefix}-{year}"
        tournament_type = "continental"
    else:
        fail(f"unknown tournament header class: {header_type}")

    if edition:
        tournament_id += f"-{edition}"
    return {
        "id": tournament_id,
        "type": tournament_type,
        "year": year,
        "nameTr": name_tr,
        "nameEn": name_en,
        "sourceUrl": source_url,
        "retrievedAt": retrieved_at,
    }


def player_identity(raw_url, display_name, country_id, search_occurrences):
    wikipedia_url = html.unescape(raw_url)
    parsed = urlsplit(wikipedia_url)
    marker = "/wiki/"
    if marker not in parsed.path:
        fail(f"unsupported player URL: {wikipedia_url}")
    path_title = unquote(parsed.path.split(marker, 1)[1]).replace("_", " ")
    if path_title != "Special:Search":
        return path_title, wikipedia_url, False, False

    query = parse_qs(parsed.query).get("search", [display_name])[0]
    base_title = f"Special:Search?search={query}"
    is_stand_by = "stand-by players" in query.casefold()
    if is_stand_by:
        search_occurrences[query] += 1
        identity = f"{base_title}#{country_id}-{search_occurrences[query]}"
    else:
        identity = base_title
    return identity, wikipedia_url, True, is_stand_by


def choose_player_record(records):
    def quality(record):
        return (
            record["position"] in {"GK", "DF", "MF", "FW"},
            record["birthYear"] is not None,
        )

    return sorted(records, key=lambda record: (
        -int(quality(record)[0]),
        -int(quality(record)[1]),
        record["countryId"],
        record["name"],
    ))[0]


def field_variants(records, field):
    values = []
    for record in records:
        value = record[field]
        if value not in values:
            values.append(value)
    return sorted(values, key=lambda value: (value is None, str(value)))


def main():
    options = country_options()
    mismatch_records = json.loads((REPORTS / "position-mismatches.json").read_text(encoding="utf-8"))
    disputed_titles = {record["title"] for record in mismatch_records}

    countries = []
    tournament_records = {}
    player_sources = defaultdict(list)
    raw_entries = []
    country_reports = []
    missing_position_rows = []
    missing_birth_rows = []
    search_link_rows = []
    stand_by_rows = []
    edition_disambiguations = []

    pages = sorted(RAW_HTML.glob(f"*{PAGE_SUFFIX}"))
    if len(pages) != 19:
        fail(f"expected 19 country pages, found {len(pages)}")

    header_pattern = re.compile(
        r'<th scope="col" class="year (world-cup|continental|olympic)">'
        r'.*?<span>(.*?)</span>(.*?)<i class="sort-indicator"',
        re.S,
    )

    for page in pages:
        source = page.read_text(encoding="utf-8")
        country_id = page.name.removesuffix(PAGE_SUFFIX)
        name_en, iso3, confederation = COUNTRY_METADATA[country_id]
        name_tr, flag_emoji = options[country_id]
        country = {
            "id": country_id,
            "nameTr": name_tr,
            "nameEn": name_en,
            "iso3": iso3,
            "flagEmoji": flag_emoji,
            "confederation": confederation,
            "theme": parse_theme(source, page.name),
        }
        countries.append(country)

        retrieved_match = re.search(r"Erişim tarihi:\s*(\d{4}-\d{2}-\d{2})", source)
        if not retrieved_match:
            fail(f"{page.name}: retrieval date is missing")
        retrieved_at = retrieved_match.group(1)
        source_links = parse_source_links(source)
        counts = parse_counts(source, page.name)
        headers = []
        for header_type, raw_name, raw_year in header_pattern.findall(source):
            name = plain_text(raw_name)
            year_label = plain_text(raw_year)
            label = f"{year_label} {name}"
            if label not in source_links:
                fail(f"{page.name}: source URL is missing for {label}")
            tournament = parse_tournament(
                header_type, name, year_label, source_links[label], retrieved_at, confederation
            )
            if year_label.endswith(("-I", "-II")):
                edition_disambiguations.append({
                    "countryId": country_id,
                    "sourceLabel": label,
                    "tournamentId": tournament["id"],
                })
            existing = tournament_records.get(tournament["id"])
            if existing is not None and existing != tournament:
                fail(f"conflicting global tournament metadata for {tournament['id']}")
            tournament_records[tournament["id"]] = tournament
            headers.append((label, tournament["id"]))

        if [label for label, _ in headers] != [item[0] for item in counts]:
            fail(f"{page.name}: column headers and counts labels differ")

        page_rows = []
        page_entry_count = 0
        search_occurrences = defaultdict(int)
        for row_number, part in enumerate(source.split('<tr data-name=')[1:], 1):
            row = part.split("</tr>", 1)[0]
            link = re.search(r'<a class="player-link" href="([^"]+)"[^>]*>(.*?)</a>', row, re.S)
            birth = re.search(r'<td class="meta birth"[^>]*>([^<]*)</td>', row)
            position = re.search(r'<span class="position-badge pos-(gk|df|mf|fw|-)"', row, re.I)
            if not link or not birth or not position:
                fail(f"{page.name}: incomplete player row {row_number}")
            name = plain_text(link.group(2))
            wikipedia_title, wikipedia_url, is_search, is_stand_by = player_identity(
                link.group(1), name, country_id, search_occurrences
            )
            birth_text = plain_text(birth.group(1))
            birth_year = int(birth_text) if re.fullmatch(r"\d{4}", birth_text) else None
            source_position = position.group(1).upper()

            source_record = {
                "countryId": country_id,
                "rowNumber": row_number,
                "name": name,
                "wikipediaTitle": wikipedia_title,
                "wikipediaUrl": wikipedia_url,
                "birthYear": birth_year,
                "position": source_position,
            }
            player_sources[wikipedia_title].append(source_record)
            page_rows.append((wikipedia_title, row))
            if source_position == "-":
                missing_position_rows.append({
                    "countryId": country_id,
                    "rowNumber": row_number,
                    "wikipediaTitle": wikipedia_title,
                })
            if birth_year is None:
                missing_birth_rows.append({
                    "countryId": country_id,
                    "rowNumber": row_number,
                    "wikipediaTitle": wikipedia_title,
                })
            if is_search:
                search_link_rows.append({
                    "countryId": country_id,
                    "rowNumber": row_number,
                    "wikipediaTitle": wikipedia_title,
                })
            if is_stand_by:
                stand_by_rows.append({
                    "countryId": country_id,
                    "rowNumber": row_number,
                    "wikipediaTitle": wikipedia_title,
                })

        for wikipedia_title, row in page_rows:
            cells = re.findall(r'<td class="number([^"]*)">(.*?)</td>', row, re.S)
            if len(cells) != len(headers):
                fail(f"{page.name}: {wikipedia_title} has {len(cells)} cells, expected {len(headers)}")
            for column_index, ((classes, raw_value), (_, tournament_id)) in enumerate(zip(cells, headers)):
                if "present" not in classes.split():
                    continue
                value = plain_text(raw_value)
                if "unavailable" in classes.split():
                    if value != "n/a":
                        fail(f"{page.name}: unavailable cell is not n/a")
                    shirt_number = None
                elif re.fullmatch(r"\d+", value):
                    shirt_number = int(value)
                else:
                    fail(f"{page.name}: invalid present shirt number {value!r}")
                raw_entries.append({
                    "countryId": country_id,
                    "tournamentId": tournament_id,
                    "wikipediaTitle": wikipedia_title,
                    "shirtNumber": shirt_number,
                    "columnIndex": column_index,
                })
                page_entry_count += 1

        expected_entry_count = sum(count for _, count in counts)
        if page_entry_count != expected_entry_count:
            fail(f"{page.name}: extracted {page_entry_count} entries, expected {expected_entry_count}")
        country_reports.append({
            "countryId": country_id,
            "playerRows": len(page_rows),
            "distinctPlayers": len({title for title, _ in page_rows}),
            "squadEntries": page_entry_count,
            "tournaments": len(headers),
            "continentalTournaments": sum(
                tournament_records[tournament_id]["type"] == "continental"
                for _, tournament_id in headers
            ),
            "sourceMissingPositionRows": sum(
                record["countryId"] == country_id for record in missing_position_rows
            ),
            "sourceMissingBirthYearRows": sum(
                record["countryId"] == country_id for record in missing_birth_rows
            ),
        })

    base_slug_groups = defaultdict(list)
    for wikipedia_title in player_sources:
        base_slug_groups[slug(wikipedia_title)].append(wikipedia_title)
    player_ids = {}
    slug_collisions = []
    for base_slug in sorted(base_slug_groups):
        titles = sorted(base_slug_groups[base_slug])
        for index, title in enumerate(titles, 1):
            player_id = base_slug if index == 1 else f"{base_slug}-{index}"
            player_ids[title] = player_id
        if len(titles) > 1:
            slug_collisions.append({
                "baseSlug": base_slug,
                "players": [
                    {"wikipediaTitle": title, "playerId": player_ids[title]}
                    for title in titles
                ],
            })

    players = []
    shared_players = []
    metadata_conflicts = []
    fallback_player_ids = []
    for wikipedia_title, records in sorted(player_sources.items()):
        chosen = choose_player_record(records)
        countries_for_player = sorted({record["countryId"] for record in records})
        position = chosen["position"]
        # The archive marks an unknown position as `pos--`. It stays unknown: inventing a
        # position here would silently fabricate a third of the dataset.
        if position == "-":
            position = None
            confidence = "unverified"
            fallback_player_ids.append(player_ids[wikipedia_title])
        elif wikipedia_title in disputed_titles:
            confidence = "disputed"
        else:
            confidence = "confirmed"
        player = {
            "id": player_ids[wikipedia_title],
            "name": chosen["name"],
            "wikipediaTitle": wikipedia_title,
            "wikipediaUrl": chosen["wikipediaUrl"],
            "birthYear": chosen["birthYear"],
            "position": position,
            "positionConfidence": confidence,
        }
        players.append(player)
        if len(countries_for_player) > 1:
            shared_players.append({
                "playerId": player["id"],
                "wikipediaTitle": wikipedia_title,
                "countryIds": countries_for_player,
            })
        variants = {
            "names": field_variants(records, "name"),
            "birthYears": field_variants(records, "birthYear"),
            "positions": field_variants(records, "position"),
            "wikipediaUrls": field_variants(records, "wikipediaUrl"),
        }
        if any(len(values) > 1 for values in variants.values()):
            metadata_conflicts.append({
                "playerId": player["id"],
                "wikipediaTitle": wikipedia_title,
                **variants,
                "decision": "preferred a row with a known position and birth year, then the first country id",
            })

    players.sort(key=lambda player: player["id"])
    tournaments = sorted(tournament_records.values(), key=lambda tournament: tournament["id"])
    squad_entries = [
        {
            "countryId": entry["countryId"],
            "tournamentId": entry["tournamentId"],
            "playerId": player_ids[entry["wikipediaTitle"]],
            "shirtNumber": entry["shirtNumber"],
        }
        for entry in raw_entries
    ]
    squad_entries.sort(key=lambda entry: (
        entry["countryId"], entry["tournamentId"], entry["playerId"]
    ))

    duplicate_entries = []
    seen_entries = set()
    for entry in squad_entries:
        key = (entry["countryId"], entry["tournamentId"], entry["playerId"])
        if key in seen_entries:
            duplicate_entries.append({
                "countryId": entry["countryId"],
                "tournamentId": entry["tournamentId"],
                "playerId": entry["playerId"],
            })
        seen_entries.add(key)
    if duplicate_entries:
        fail(f"duplicate squad entries after player normalisation: {duplicate_entries[:3]}")

    write_json(DIST / "countries.json", countries)
    write_json(DIST / "tournaments.json", tournaments)
    write_json(DIST / "players.json", players)
    write_json(DIST / "squad-entries.json", squad_entries)

    countries_by_id = {country["id"]: country for country in countries}
    tournaments_by_id = {tournament["id"]: tournament for tournament in tournaments}
    players_by_id = {player["id"]: player for player in players}
    for country_id in sorted(countries_by_id):
        entries = [entry for entry in squad_entries if entry["countryId"] == country_id]
        tournament_ids = {entry["tournamentId"] for entry in entries}
        country_player_ids = {entry["playerId"] for entry in entries}
        view = {
            "country": countries_by_id[country_id],
            "tournaments": [tournaments_by_id[item] for item in sorted(tournament_ids)],
            "players": [players_by_id[item] for item in sorted(country_player_ids)],
            "squadEntries": entries,
        }
        write_json(DIST / "by-country" / f"{country_id}.json", view)

    report = {
        "sourceFiles": len(pages) + 1,
        "countryCount": len(countries),
        "totalPlayerRows": sum(item["playerRows"] for item in country_reports),
        "totalSquadEntries": len(squad_entries),
        "tournamentCount": len(tournaments),
        "playerCount": len(players),
        "countries": sorted(country_reports, key=lambda item: item["countryId"]),
        "anomalies": {
            "sourceMissingPositions": {
                "rowCount": len(missing_position_rows),
                "outputPlayerCount": len(fallback_player_ids),
                "position": None,
                "positionConfidence": "unverified",
                "decision": "the raw source marks these as 'pos--'; they are carried through as position=null with positionConfidence='unverified' rather than being guessed",
                "playerIds": sorted(fallback_player_ids),
            },
            "sourceMissingBirthYears": {
                "rowCount": len(missing_birth_rows),
                "decision": "represented as null because the raw source uses '-'",
                "rows": missing_birth_rows,
            },
            "searchLinks": {
                "rowCount": len(search_link_rows),
                "decision": "used the search query as part of wikipediaTitle because Special:Search is not a player title",
                "rows": search_link_rows,
            },
            "standByRows": {
                "rowCount": len(stand_by_rows),
                "decision": "added country and occurrence suffixes to generic Special:Search identities so every source row remains distinct",
                "rows": stand_by_rows,
            },
            "sharedPlayers": shared_players,
            "metadataConflicts": metadata_conflicts,
            "slugCollisions": slug_collisions,
            "editionDisambiguations": {
                "decision": "appended 1 or 2 to the two 1959 Copa América ids while retaining integer year 1959",
                "occurrences": edition_disambiguations,
            },
            "sourceCellSemantics": {
                "decision": "a '-' cell means no squad entry; a present 'n/a' cell produces an entry with null shirtNumber",
            },
        },
    }
    write_json(DIST / "extraction-report.json", report)
    print(
        f"extraction: countries={len(countries)} tournaments={len(tournaments)} "
        f"players={len(players)} rows={report['totalPlayerRows']} entries={len(squad_entries)}"
    )


if __name__ == "__main__":
    main()
