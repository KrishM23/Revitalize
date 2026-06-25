#!/usr/bin/env python3
"""Refresh data/uc_emissions.csv from UC sustainability report Google Sheets.

Sources:
  - UC Annual Sustainability Report 2024 (calendar year 2023)
  - UC Annual Sustainability Report 2025 (calendar year 2024)

Run: python3 scripts/update_emissions.py
"""

from __future__ import annotations

import csv
import io
import re
import subprocess
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "uc_emissions.csv"

CAMPUS_SLUGS = {
    "berkeley": "uc-berkeley",
    "davis": "uc-davis",
    "irvine": "uc-irvine",
    "ucla": "ucla",
    "merced": "uc-merced",
    "riverside": "uc-riverside",
    "ucsd": "uc-san-diego",
    "ucsf": "uc-san-francisco",
    "ucsb": "uc-santa-barbara",
    "ucsc": "uc-santa-cruz",
}

SYSTEMWIDE_SHEET = ("1_TuGWYKcgjG5cRuDTEU6Qw4jVUAIoBVxEVoQRfwet98", "Systemwide")
UPDATE_YEARS = set(range(2015, 2025))


def parse_num(value: str | None) -> int | None:
    if value is None:
        return None
    text = str(value).strip().strip('"').replace(",", "")
    if not text:
        return None
    try:
        return int(round(float(text)))
    except ValueError:
        return None


def fetch_csv(sheet_id: str, sheet_name: str) -> str:
    url = (
        f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq"
        f"?tqx=out:csv&sheet={urllib.parse.quote(sheet_name)}"
    )
    return subprocess.check_output(["curl", "-sL", url], text=True)


def parse_emissions_sheet(csv_text: str) -> dict[int, dict]:
    rows = list(csv.reader(io.StringIO(csv_text)))
    out: dict[int, dict] = {}
    pending_2019: dict | None = None
    for row in rows[1:]:
        if not row:
            continue
        year = parse_num(row[0])
        s1 = parse_num(row[1] if len(row) > 1 else None)
        s2 = parse_num(row[2] if len(row) > 2 else None)
        s3 = parse_num(row[3] if len(row) > 3 else None)
        if year is None and s1 is not None and pending_2019 is None:
            pending_2019 = {"scope1": s1, "scope2": s2, "scope3": s3}
            continue
        if year is None or year < 1990 or year > 2030:
            continue
        if s1 is None and s2 is None and s3 is None:
            continue
        total = sum(x for x in (s1, s2, s3) if x is not None)
        out[year] = {"scope1": s1, "scope2": s2, "scope3": s3, "total": total}
    if pending_2019 and 2019 not in out:
        total = sum(x for x in pending_2019.values() if x is not None)
        out[2019] = {**pending_2019, "total": total}
    return out


def get_emissions_chart(report: str, slug: str) -> tuple[str, str] | None:
    url = f"https://sustainabilityreport.ucop.edu/{report}/locations/{slug}/"
    html = subprocess.check_output(["curl", "-s", url], text=True)
    match = re.search(
        r'id="emissions"[\s\S]*?"sheet_id":"([^"]+)","data_range":"([^"]+)"', html
    )
    if not match:
        match = re.search(
            r'"title":"EMISSIONS"[\s\S]*?"sheet_id":"([^"]+)","data_range":"([^"]+)"',
            html,
        )
    if not match:
        return None
    sheet = match.group(2).split("!")[0]
    return match.group(1), sheet


def source_for_year(year: int) -> str:
    if year == 2024:
        return "UC Annual Sustainability Report 2025"
    if year == 2023:
        return "UC Annual Sustainability Report 2024"
    if year == 2022:
        return "UC Annual Sustainability Report 2024 (revised scopes)"
    return "UC Annual Sustainability Report"


def row_dict(campus_id: str, year: int, data: dict, source: str) -> dict:
    return {
        "campus_id": campus_id,
        "year": year,
        "scope1": data["scope1"] if data["scope1"] is not None else "",
        "scope2": data["scope2"] if data["scope2"] is not None else "",
        "scope3": data["scope3"] if data["scope3"] is not None else "",
        "total": data["total"],
        "verified": "true",
        "source": source,
    }


def main() -> None:
    existing = list(csv.DictReader(OUT.open()))
    official: dict[str, dict[int, dict]] = {}
    official["systemwide"] = parse_emissions_sheet(
        fetch_csv(*SYSTEMWIDE_SHEET)
    )

    for campus_id, slug in CAMPUS_SLUGS.items():
        merged: dict[int, dict] = {}
        for report in ("2024", "2025"):
            info = get_emissions_chart(report, slug)
            if not info:
                continue
            merged.update(parse_emissions_sheet(fetch_csv(*info)))
        official[campus_id] = merged

    new_rows: list[dict] = []
    seen: set[tuple[str, int]] = set()

    for row in existing:
        campus_id = row["campus_id"]
        year = int(row["year"])
        key = (campus_id, year)
        if campus_id in official and year in official[campus_id] and year in UPDATE_YEARS:
            data = official[campus_id][year]
            new_rows.append(row_dict(campus_id, year, data, source_for_year(year)))
        else:
            new_rows.append(row)
        seen.add(key)

    for campus_id in ["systemwide", *CAMPUS_SLUGS]:
        for year in (2023, 2024):
            key = (campus_id, year)
            if key in seen:
                continue
            if campus_id not in official or year not in official[campus_id]:
                continue
            new_rows.append(
                row_dict(campus_id, year, official[campus_id][year], source_for_year(year))
            )
            seen.add(key)

    # Systemwide historical scope rows from the 2025 sheet
    for year, source in (
        (2009, "UC Annual Sustainability Report 2025 (revised scopes)"),
        (2019, "UC Annual Sustainability Report 2025 (revised scopes)"),
    ):
        key = ("systemwide", year)
        if key in seen and year in official["systemwide"]:
            new_rows = [
                row_dict("systemwide", year, official["systemwide"][year], source)
                if row["campus_id"] == "systemwide" and int(row["year"]) == year
                else row
                for row in new_rows
            ]

    new_rows.sort(key=lambda r: (r["campus_id"], int(r["year"])))
    with OUT.open("w", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "campus_id",
                "year",
                "scope1",
                "scope2",
                "scope3",
                "total",
                "verified",
                "source",
            ],
        )
        writer.writeheader()
        writer.writerows(new_rows)

    latest = max(int(r["year"]) for r in new_rows)
    print(f"Wrote {len(new_rows)} rows to {OUT} (latest year: {latest})")


if __name__ == "__main__":
    main()
