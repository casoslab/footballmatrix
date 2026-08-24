from __future__ import annotations

import html
import json
import re
import time
import xml.etree.ElementTree as ET
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote, unquote

import requests


ROOT = Path(__file__).resolve().parents[2]
RAW_HTML = ROOT / "data" / "raw" / "html"
REPORTS = ROOT / "data" / "dist" / "reports"
EXPORT = "https://en.wikipedia.org/wiki/Special:Export"
HEADERS = {"User-Agent": "footballmatrix/1.0 (+https://github.com/casoslab/footballmatrix)"}
NS = "{http://www.mediawiki.org/xml/export-0.11/}"


def chunks(items, size=10):
    for start in range(0, len(items), size):
        yield items[start : start + size]


def local_players():
    players = defaultdict(list)
    for page in sorted(RAW_HTML.glob("*-dunya-kupasi-kadrolari.html")):
        source = page.read_text(encoding="utf-8")
        for part in source.split('<tr data-name=')[1:]:
            row = part.split("</tr>", 1)[0]
            link = re.search(r'<a class="player-link" href="([^"]+)"[^>]*>(.*?)</a>', row, re.S)
            position = re.search(r'<span class="position-badge pos-(gk|df|mf|fw)">', row, re.I)
            if not link or not position or "Special:Search" in link.group(1):
                continue
            title = html.unescape(unquote(link.group(1).split("/wiki/", 1)[-1])).replace("_", " ")
            name = html.unescape(re.sub(r"<[^>]+>", "", link.group(2)))
            players[title].append({"page": page.name, "name": name, "position": position.group(1).upper()})
    return players


def export_pages(titles, label):
    output = {}
    groups = list(chunks(sorted(set(titles))))

    def fetch(group):
        for attempt in range(6):
            try:
                response = requests.post(
                    EXPORT,
                    data={"pages": "\n".join(group), "curonly": "1"},
                    headers=HEADERS,
                    timeout=180,
                )
                response.raise_for_status()
                root = ET.fromstring(response.content)
                break
            except Exception:
                if attempt == 5:
                    raise
                time.sleep(3 * (attempt + 1))
        found = {}
        for page in root.findall(f".//{NS}page"):
            title_node = page.find(f"{NS}title")
            text_node = page.find(f".//{NS}revision/{NS}text")
            if title_node is not None and text_node is not None:
                found[title_node.text or ""] = text_node.text or ""
        return found

    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = [pool.submit(fetch, group) for group in groups]
        for number, future in enumerate(as_completed(futures), 1):
            output.update(future.result())
            if number % 20 == 0 or number == len(groups):
                print(f"{label} {number}/{len(groups)}", flush=True)
    return output


def position_field(wikitext):
    lines = wikitext.splitlines()
    start = None
    value = ""
    for index, line in enumerate(lines):
        match = re.match(r"^\|\s*positions?\s*=\s*(.*)$", line, re.I)
        if match:
            start = index
            value = match.group(1)
            break
    if start is None:
        return ""
    brace_balance = value.count("{{") - value.count("}}")
    link_balance = value.count("[[") - value.count("]]" )
    index = start + 1
    while index < len(lines) and (brace_balance > 0 or link_balance > 0 or not value.strip()):
        line = lines[index]
        if value.strip() and brace_balance <= 0 and link_balance <= 0 and re.match(r"^\|\s*\w", line):
            break
        value += "\n" + line
        brace_balance += line.count("{{") - line.count("}}")
        link_balance += line.count("[[") - line.count("]]" )
        index += 1
    return value.strip()


PATTERNS = {
    "GK": [r"goalkeeper"],
    "DF": [r"defender", r"full[- ]?back", r"centre[- ]?back", r"center[- ]?back", r"wing[- ]?back", r"sweeper", r"left[- ]?back", r"right[- ]?back"],
    "MF": [r"midfielder", r"midfield", r"wing[- ]?half", r"half[- ]?back"],
    "FW": [r"forward", r"striker", r"winger"],
}


def categories(field):
    lowered = html.unescape(field).casefold()
    found = []
    for category, patterns in PATTERNS.items():
        for pattern in patterns:
            for match in re.finditer(pattern, lowered):
                found.append((match.start(), category))
    ordered = []
    for _, category in sorted(found):
        if category not in ordered:
            ordered.append(category)
    return ordered


def main():
    players = local_players()
    pages = export_pages(players, "Oyuncu sayfaları")
    redirects = {}
    for title, text in pages.items():
        match = re.match(r"\s*#redirect\s*\[\[([^\]#]+)", text, re.I)
        if match:
            redirects[title] = html.unescape(match.group(1).strip())
    redirect_pages = export_pages(redirects.values(), "Yönlendirmeler") if redirects else {}

    mismatches = []
    checked = 0
    for title, records in players.items():
        source_title = redirects.get(title, title)
        text = redirect_pages.get(source_title, pages.get(title, ""))
        field = position_field(text)
        cats = categories(field)
        if not cats:
            continue
        checked += 1
        primary = cats[0]
        for record in records:
            if record["position"] != primary:
                mismatches.append({
                    **record,
                    "title": title,
                    "source_title": source_title,
                    "wikipedia": f"https://en.wikipedia.org/wiki/{quote(source_title.replace(' ', '_'))}",
                    "position_field": field,
                    "categories": cats,
                    "suggested": primary,
                })
    REPORTS.mkdir(parents=True, exist_ok=True)
    output = REPORTS / "position-mismatches.json"
    output.write_text(json.dumps(mismatches, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"players={len(players)} checked={checked} redirects={len(redirects)} mismatches={len(mismatches)}")


if __name__ == "__main__":
    main()
