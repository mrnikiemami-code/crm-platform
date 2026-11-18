"""Extracts text from a PDF with PyMuPDF (MuPDF), as an independent consumer.

MuPDF is used because it implements `/ActualText`, which is the mechanism the remedy relies on.
pdf.js does NOT implement it (measured: zero occurrences in its source), so pdf.js cannot be the
witness for this particular claim — see the S1-R2 report.

MuPDF returns right-to-left text in VISUAL order, so `reversed` is the logical reading of a line for
an RTL document, and is what the caller compares against the source.

Usage: python extract-with-mupdf.py <pdf> [--raw]
Prints one JSON object per line: {"visual": ..., "logical": ...}
"""

import json
import sys

import pymupdf


def main() -> int:
    path = sys.argv[1]
    document = pymupdf.open(path)
    lines = []

    for page in document:
        for line in page.get_text().splitlines():
            if line.strip() == "":
                continue
            lines.append({"visual": line, "logical": line[::-1]})

    print(json.dumps({"pageCount": document.page_count, "lines": lines}, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    sys.exit(main())
