#!/usr/bin/env python3
"""Extract governed, provenance-preserving tables from a brand-health PPTX.

This is intentionally conservative. It extracts high-confidence DMA profile,
brand-funnel, brand-relevance, and driver observations, plus every source table
cell for review. It does not infer DMA-to-CBSA relationships or scoring use.
"""

import argparse
import csv
import hashlib
import json
import os
import re
import zipfile
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
import xml.etree.ElementTree as ET

NS = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}
BRANDS = ["Chewy", "Amazon", "Walmart", "PetSmart", "Petco"]
FUNNEL_METRICS = ["Awareness", "Familiarity", "Consideration", "Usage P12M"]
DEMO_METRICS = ["Purchase Pet Products Online (T2B)", "Children in household", "Acquired Pet P12M", "Acquired Dog", "Acquired Cat"]


def clean(value: str) -> str:
    value = unescape(value or "").replace("\uf0e1", "significant").replace("\u2191", "up").replace("\u2193", "down")
    return re.sub(r"\s+", " ", value).strip()


def slide_number(name: str) -> int:
    return int(re.search(r"slide(\d+)\.xml$", name).group(1))


def slide_root(zf: zipfile.ZipFile, number: int):
    return ET.fromstring(zf.read(f"ppt/slides/slide{number}.xml"))


def slide_text(root) -> str:
    return clean(" ".join(node.text or "" for node in root.findall(".//a:t", NS)))


def tables(root):
    output = []
    for table_index, table in enumerate(root.findall(".//a:tbl", NS)):
        rows = []
        for row_index, tr in enumerate(table.findall("a:tr", NS)):
            cells = []
            for column_index, tc in enumerate(tr.findall("a:tc", NS)):
                cells.append({
                    "table_index": table_index,
                    "row_index": row_index,
                    "column_index": column_index,
                    "value": clean(" ".join(node.text or "" for node in tc.findall(".//a:t", NS))),
                })
            rows.append(cells)
        output.append(rows)
    return output


def value_number(value: str):
    match = re.search(r"-?\d+(?:\.\d+)?", value.replace(",", ""))
    return float(match.group(0)) if match else None


def dma_id(name: str) -> str:
    return "DMA_" + re.sub(r"[^A-Z0-9]+", "_", name.upper()).strip("_")


def parse_displayed(value: str):
    raw = value or ""
    percent = re.search(r"(\d+(?:\.\d+)?)%", raw)
    rank_match = re.search(r"\((\d+)\)", raw)
    return {
        "value": float(percent.group(1)) if percent else None,
        "value_unit": "percent" if percent else None,
        "rank": int(rank_match.group(1)) if rank_match else None,
        "significant": "significant" in raw,
        "direction": "down" if "down" in raw else ("up" if "up" in raw else None),
        "value_raw": raw,
    }


def profile_from_slide(number, text, slide_tables):
    if not ("Survey Data" in text and "DMA" in text):
        return None
    dma_match = re.search(r"(?:Demo )?([A-Z]{2,4}) DMA", text)
    if not dma_match:
        return None
    dma_code = dma_match.group(1)
    name_candidates = re.findall(r"([A-Za-z][A-Za-z .&-]{2,}) DMA \d+ counties", text)
    name_candidates = [clean(candidate) for candidate in name_candidates]
    dma_name = name_candidates[0] if name_candidates else dma_code
    region_match = re.search(r"(Northeast|Midwest|South|West) Region", text, re.I)
    region = region_match.group(1).title() if region_match else None
    county_match = re.search(r"(\d+) counties?:(.*?)(?:Northeast|Midwest|South|West) region", text, re.I)
    profile = {
        "source_id": "SRC-033",
        "source_status": "Workspace only",
        "evidence_status": "Reported",
        "source_slide": number,
        "dma_code_in_source": dma_code,
        "dma_name": dma_name,
        "dma_id": dma_id(dma_name),
        "region": region,
        "county_coverage": clean(county_match.group(0)) if county_match else None,
        "field_start": "2024-04-11",
        "field_end": "2024-05-15",
        "study_wave": "June 2024 DMA and Generation Add-on",
        "sample_scope": "Pet owners in top 32 DMAs by pet population",
        "bdi": None,
        "cdi": None,
        "pet_owner_population_millions": None,
        "brand_funnel_count": None,
    }
    if len(slide_tables) > 2:
        for row in slide_tables[2]:
            if len(row) >= 2:
                label, raw = row[0]["value"], row[1]["value"]
                if label == "BDI": profile["bdi"] = value_number(raw)
                if label == "CDI": profile["cdi"] = value_number(raw)
                if label == "Pet Owner Pop": profile["pet_owner_population_millions"] = value_number(raw)
        if len(slide_tables[2]) > 0:
            profile["brand_funnel_count"] = value_number(next((c["value"] for c in slide_tables[0][0] if c["value"].isdigit()), "")) if slide_tables[0] else None
    return profile


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    source_hash = hashlib.sha256(args.input.read_bytes()).hexdigest()
    source_name = args.input.name
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    with zipfile.ZipFile(args.input) as zf:
        numbers = sorted(slide_number(name) for name in zf.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", name))
        inventories, cells, profiles, funnel_rows, relevance_rows, driver_rows, generation_cells = [], [], [], [], [], [], []
        generation_funnel_rows, generation_driver_rows = [], []
        for number in numbers:
            root = slide_root(zf, number)
            text = slide_text(root)
            slide_tables = tables(root)
            inventories.append({"source_id": "SRC-033", "source_slide": number, "slide_text": text, "table_count": len(slide_tables)})
            for table_index, table in enumerate(slide_tables):
                for row in table:
                    for cell in row:
                        record = {"source_id": "SRC-033", "source_slide": number, **cell}
                        cells.append(record)
            profile = profile_from_slide(number, text, slide_tables)
            if profile:
                profiles.append(profile)
                if len(slide_tables) > 4:
                    table = slide_tables[4]
                    funnel_row_indexes = [0, 2, 4, 6]
                    for metric_index, metric in enumerate(FUNNEL_METRICS):
                        row_index = funnel_row_indexes[metric_index]
                        if row_index < len(table):
                            row = table[row_index]
                            values = [c["value"] for c in row[1:6]]
                            for brand, raw in zip(BRANDS, values):
                                parsed = parse_displayed(raw)
                                funnel_rows.append({"source_id": profile["source_id"], "evidence_status": "Reported", "source_slide": number, "dma_id": profile["dma_id"], "dma_name": profile["dma_name"], "segment": "All pet parents", "metric": metric, "attribute": None, "brand": brand, **parsed, "source_note": "Visual brand column order verified from rendered slide."})
                companion_tables = tables(slide_root(zf, number + 1)) if number + 1 in numbers else []
                if len(companion_tables) > 0 and len(companion_tables[0]) >= 1:
                    for row in companion_tables[0]:
                        if row:
                            label = row[0]["value"]
                            if label in ["Overall Score", "Likeability (T2B)", "Meets Needs (T2B)", "Value (T2B)", "Uniqueness (T2B)", "Relative Strength (6+)"]:
                                for brand, cell in zip(BRANDS, row[1:6]):
                                    parsed = parse_displayed(cell["value"])
                                    relevance_rows.append({"source_id": profile["source_id"], "evidence_status": "Reported", "source_slide": number + 1, "dma_id": profile["dma_id"], "dma_name": profile["dma_name"], "segment": "All pet parents", "metric": label, "attribute": None, "brand": brand, **parsed})
                if len(companion_tables) > 1:
                    for driver_index, row in enumerate(companion_tables[1]):
                        if row and row[0]["value"]:
                            for brand, cell in zip(BRANDS, row[1:6]):
                                parsed = parse_displayed(cell["value"])
                                driver_rows.append({"source_id": profile["source_id"], "evidence_status": "Reported", "source_slide": number + 1, "dma_id": profile["dma_id"], "dma_name": profile["dma_name"], "segment": "All pet parents", "metric": None, "attribute": row[0]["value"], "driver_order": driver_index + 1, "brand": brand, **parsed})
            generation_title = re.search(r"([A-Za-z][A-Za-z .&-]+) DMA\s*[–-]\s*(Gen Z\s*/\s*Millennials|Gen Z/Millennial|Gen X|Boomer/Silent)\s+Pet Parents", text)
            if generation_title:
                generation_dma = clean(generation_title.group(1))
                segment = "Gen Z/Millennials" if generation_title.group(2).startswith("Gen Z") else generation_title.group(2)
                generation_profile = next((item for item in profiles if item["dma_name"] == generation_dma), None)
                generation_dma_id = generation_profile["dma_id"] if generation_profile else dma_id(generation_dma or "UNKNOWN")
                generation_sample = int(re.search(r"\(n=(\d+)\)", text).group(1)) if re.search(r"\(n=(\d+)\)", text) else None
                if slide_tables and slide_tables[0] and slide_tables[0][0] and slide_tables[0][0][0]["value"].endswith("Region"):
                    driver_table = slide_tables[1] if len(slide_tables) > 1 else []
                    funnel_table = slide_tables[2] if len(slide_tables) > 2 else []
                    for driver_index, row in enumerate(driver_table):
                        if not row or not row[0]["value"]:
                            continue
                        for brand, cell in zip(BRANDS, row[1:6]):
                            parsed = parse_displayed(cell["value"])
                            generation_driver_rows.append({"source_id": "SRC-033", "evidence_status": "Reported", "source_slide": number, "dma_id": generation_dma_id, "dma_name": generation_dma, "segment": segment, "metric": None, "attribute": row[0]["value"], "driver_order": driver_index + 1, "brand": brand, "value": parsed["value"], "value_unit": parsed["value_unit"], "value_raw": parsed["value_raw"], "rank": parsed["rank"], "significant": parsed["significant"], "sample_size": generation_sample})
                else:
                    driver_table = slide_tables[1] if len(slide_tables) > 1 else []
                    value_table = slide_tables[0] if slide_tables else []
                    labels = [row[0]["value"] for row in driver_table if row and row[0]["value"]]
                    for index, label in enumerate(labels):
                        if index * 2 + 1 >= len(value_table):
                            continue
                        value_row = value_table[index * 2]
                        rank_row = value_table[index * 2 + 1]
                        for brand, value_cell, rank_cell in zip(BRANDS, value_row, rank_row):
                            parsed = parse_displayed(value_cell["value"])
                            rank = parse_displayed(rank_cell["value"])["rank"] or parsed["rank"]
                            generation_driver_rows.append({"source_id": "SRC-033", "evidence_status": "Reported", "source_slide": number, "dma_id": generation_dma_id, "dma_name": generation_dma, "segment": segment, "metric": None, "attribute": label, "driver_order": index + 1, "brand": brand, "value": parsed["value"], "value_unit": parsed["value_unit"], "value_raw": parsed["value_raw"], "rank": rank, "significant": parsed["significant"], "sample_size": generation_sample})
                    funnel_table = slide_tables[3] if len(slide_tables) > 3 else []
                if funnel_table:
                    for metric_index, metric in enumerate(FUNNEL_METRICS):
                        row_index = metric_index * 3
                        if row_index >= len(funnel_table):
                            continue
                        value_row = funnel_table[row_index]
                        rank_row = funnel_table[row_index + 1] if row_index + 1 < len(funnel_table) else []
                        for brand, value_cell, rank_cell in zip(BRANDS, value_row[1:6], rank_row[1:6]):
                            parsed = parse_displayed(value_cell["value"])
                            generation_funnel_rows.append({"source_id": "SRC-033", "evidence_status": "Reported", "source_slide": number, "dma_id": generation_dma_id, "dma_name": generation_dma, "segment": segment, "metric": metric, "attribute": None, "brand": brand, "value": parsed["value"], "value_unit": parsed["value_unit"], "value_raw": parsed["value_raw"], "rank": parse_displayed(rank_cell["value"])["rank"], "significant": parsed["significant"], "sample_size": generation_sample})
                for record in cells:
                    if record["source_slide"] == number:
                        generation_cells.append({**record, "evidence_status": "Reported", "segment_label": segment})

    def write_json(name, value):
        (args.output / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")

    def write_csv(name, rows):
        path = args.output / name
        fields = sorted({key for row in rows for key in row})
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields)
            writer.writeheader()
            writer.writerows(rows)

    write_json("slide-inventory.json", inventories)
    write_json("extracted-table-cells.json", cells)
    write_json("generation-table-cells.json", generation_cells)
    write_csv("dma-profiles.csv", profiles)
    write_csv("dma-reference.csv", [{"dma_id": item["dma_id"], "dma_name": item["dma_name"], "dma_name_raw": item["dma_name"], "geography_type": "DMA", "reference_version": "source-slide-derived-v1", "source_id": item["source_id"], "status": "source_derived"} for item in profiles])
    write_csv("brand-funnel-observations.csv", funnel_rows)
    write_csv("brand-relevance-observations.csv", relevance_rows)
    write_csv("brand-driver-observations.csv", driver_rows)
    write_csv("generation-funnel-observations.csv", generation_funnel_rows)
    write_csv("generation-driver-observations.csv", generation_driver_rows)
    manifest = {
        "manifest_version": "brand-health-ppt-extraction-v1",
        "snapshot_version": "chewy-brand-health-2024-dma-generation-v1",
        "built_at": generated_at,
        "source_id": "SRC-033",
        "source_file": source_name,
        "source_sha256": source_hash,
        "source_status": "Workspace only",
        "evidence_status": "Reported",
        "sensitivity": "confidential",
        "allowed_use": "local market-context and consumer-insight review pending owner approval",
        "scoring_eligibility": "none",
        "field_dates": {"start": "2024-04-11", "end": "2024-05-15"},
        "sample": {"total_pet_owners": 12735, "dma_count": 32, "generation_deep_dive_dma_count": 13},
        "outputs": {
            "dma_profiles": len(profiles),
            "brand_funnel_observations": len(funnel_rows),
            "brand_relevance_observations": len(relevance_rows),
            "brand_driver_observations": len(driver_rows),
            "generation_funnel_observations": len(generation_funnel_rows),
            "generation_driver_observations": len(generation_driver_rows),
            "generation_table_cells": len(generation_cells),
            "extracted_table_cells": len(cells),
        },
        "known_issues": [
            "DMA identifiers are preserved as source labels; no DMA-to-CBSA join was performed.",
            "Generation deep-dive tables retain source cells for review because the rendered layout separates labels, values, ranks, and benchmark boxes.",
            "Brand column order is Chewy, Amazon, Walmart, PetSmart, Petco and was checked against rendered slides.",
            "Correlations, derived importance, significance markers, and narrative claims require separate claim-level review.",
            "No output is eligible for deterministic clinic-site scoring.",
        ],
    }
    write_json("manifest.json", manifest)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
