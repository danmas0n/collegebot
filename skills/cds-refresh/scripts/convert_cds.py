#!/usr/bin/env python3
"""Convert raw CDS filings (PDF/XLSX) to plain text for LLM extraction.

Usage: python3 convert_cds.py <raw_dir> <text_dir>

PDFs go through pypdf text extraction; XLSX sheets are flattened to
tab-separated lines. Files yielding <500 chars (scanned images, corrupt
workbooks) are reported as failures — re-source those in another format
rather than OCRing.
"""
import os
import sys
import warnings

warnings.filterwarnings("ignore")
from pypdf import PdfReader  # noqa: E402
import openpyxl  # noqa: E402

MIN_CHARS = 500


def convert_pdf(path):
    return "\n".join((p.extract_text() or "") for p in PdfReader(path).pages)


def convert_xlsx(path):
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    parts = []
    for ws in wb.worksheets:
        parts.append(f"=== SHEET: {ws.title} ===")
        for row in ws.iter_rows(values_only=True):
            cells = [str(c) for c in row if c is not None and str(c).strip()]
            if cells:
                parts.append("\t".join(cells))
    return "\n".join(parts)


def main():
    raw_dir, text_dir = sys.argv[1], sys.argv[2]
    os.makedirs(text_dir, exist_ok=True)
    ok, fail = 0, []
    for name in sorted(os.listdir(raw_dir)):
        base, ext = os.path.splitext(name)
        ext = ext.lower().lstrip(".")
        if ext not in ("pdf", "xlsx"):
            continue
        dst = os.path.join(text_dir, base + ".txt")
        if os.path.exists(dst):
            ok += 1
            continue
        try:
            text = (convert_pdf if ext == "pdf" else convert_xlsx)(os.path.join(raw_dir, name))
            if len(text.strip()) < MIN_CHARS:
                fail.append((name, f"too short ({len(text.strip())} chars) — likely scanned image"))
                continue
            with open(dst, "w") as f:
                f.write(text)
            ok += 1
        except Exception as e:  # noqa: BLE001 — report and continue over a corpus
            fail.append((name, str(e)[:120]))
    print(f"converted {ok}, failed {len(fail)}")
    for name, err in fail:
        print(f"FAIL\t{name}\t{err}")
    sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()
