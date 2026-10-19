"""File input / output helpers (Excel & CSV).

The uploaded source files are NEVER modified — everything happens in memory
and results are written to a brand-new workbook built with openpyxl.
"""

from __future__ import annotations

import io
import re
from typing import List, Optional, Tuple

import pandas as pd

SUPPORTED_EXTENSIONS = (".xlsx", ".csv")


class FileFormatError(Exception):
    """Raised for unreadable / unsupported uploads with a user-friendly message."""


def _lower_suffix(filename: str) -> str:
    name = (filename or "").lower()
    for ext in SUPPORTED_EXTENSIONS:
        if name.endswith(ext):
            return ext
    return ""


def list_sheets(file_bytes: bytes, filename: str) -> List[str]:
    """Worksheet names for .xlsx uploads; a single pseudo-name for CSV."""
    ext = _lower_suffix(filename)
    if ext == ".csv":
        return ["CSV (single table)"]
    if ext == ".xlsx":
        try:
            from openpyxl import load_workbook

            wb = load_workbook(io.BytesIO(file_bytes), read_only=True)
            names = list(wb.sheetnames)
            wb.close()
            return names
        except Exception as exc:  # corrupt / password protected / old .xls
            raise FileFormatError(
                "Could not read the Excel file. Please make sure it is a valid "
                f".xlsx workbook (older .xls files must be re-saved as .xlsx). Details: {exc}"
            ) from exc
    raise FileFormatError(
        f"Unsupported file type '{filename}'. Please upload a .xlsx or .csv file."
    )


def read_table(
    file_bytes: bytes,
    filename: str,
    sheet: Optional[str] = None,
    max_rows: Optional[int] = None,
) -> pd.DataFrame:
    """Read an uploaded file into a DataFrame without touching the source.

    * CSV : tries utf-8 first, falls back to latin-1 and ';' delimiter.
    * XLSX: reads the requested sheet (or the first one) with openpyxl.
    """
    ext = _lower_suffix(filename)
    buffer = io.BytesIO(file_bytes)

    if ext == ".csv":
        if not file_bytes.strip():
            raise FileFormatError("The CSV file is empty.")
        df = _read_csv_buffer(buffer)
    elif ext == ".xlsx":
        try:
            df = pd.read_excel(buffer, sheet_name=sheet if sheet else 0, engine="openpyxl", nrows=max_rows)
        except FileFormatError:
            raise
        except ValueError as exc:
            raise FileFormatError(f"The sheet '{sheet}' could not be found in the workbook. Details: {exc}") from exc
        except Exception as exc:
            raise FileFormatError(
                "Could not parse the Excel file. Please check that it is not corrupted "
                f"or password protected. Details: {exc}"
            ) from exc
    else:
        raise FileFormatError(
            f"Unsupported file type '{filename}'. Please upload a .xlsx or .csv file."
        )

    df = _tidy_frame(df)
    if df.empty and len(df.columns) == 0:
        raise FileFormatError("The file appears to be empty (no columns found).")
    return df


def _read_csv_buffer(buffer: io.BytesIO) -> pd.DataFrame:
    attempts: Tuple[dict, ...] = (
        {"encoding": "utf-8", "sep": None},   # sniff delimiter (comma, tab, ;)
        {"encoding": "latin-1", "sep": None},
        {"encoding": "utf-8-sig", "sep": ","},
    )
    last_error: Optional[Exception] = None
    for kwargs in attempts:
        try:
            buffer.seek(0)
            engine = "python" if kwargs.get("sep") is None else "c"
            return pd.read_csv(buffer, engine=engine, **kwargs)
        except UnicodeDecodeError as exc:
            last_error = exc
        except pd.errors.ParserError as exc:
            last_error = exc
        except pd.errors.EmptyDataError as exc:
            raise FileFormatError("The CSV file is empty.") from exc
    raise FileFormatError(f"Could not decode the CSV file. Details: {last_error}")


def _tidy_frame(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize column labels: strings, trimmed, de-duplicated.

    pandas renames duplicate headers to ``'Name .1'`` — those are turned into
    friendlier ``'Name (1)'`` labels, and plain duplicates get the same
    treatment.
    """
    df = df.copy()
    stripped = [str(c).strip() for c in df.columns]

    used: set = set()
    new_cols: List[str] = []
    for c in stripped:
        m = re.match(r"^(.*\S)\s*\.\d+$", c)
        base = m.group(1) if m else c
        if c in used or (m and base in used):
            k = 1
            while f"{base} ({k})" in used:
                k += 1
            c = f"{base} ({k})"
        used.add(c)
        new_cols.append(c)
    df.columns = new_cols
    # Drop fully-empty unnamed columns (Excel artifacts)
    drop = [c for c in df.columns if c.startswith("Unnamed") and df[c].isna().all()]
    return df.drop(columns=drop)


def export_workbook(
    processed: pd.DataFrame,
    validation_issues: pd.DataFrame,
    unmatched_words: pd.DataFrame,
) -> bytes:
    """Build a NEW .xlsx in memory with three sheets and return its bytes."""
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        processed.to_excel(writer, sheet_name="Processed Data", index=False)
        if validation_issues is None or validation_issues.empty:
            pd.DataFrame({"Result": ["No validation issues found 🎉"]}).to_excel(
                writer, sheet_name="Validation Issues", index=False
            )
        else:
            validation_issues.to_excel(writer, sheet_name="Validation Issues", index=False)
        if unmatched_words is None or unmatched_words.empty:
            pd.DataFrame({"Result": ["All words matched an approved abbreviation 🎉"]}).to_excel(
                writer, sheet_name="Unmatched Words", index=False
            )
        else:
            unmatched_words.to_excel(writer, sheet_name="Unmatched Words", index=False)
        _autosize(writer.book)
    buffer.seek(0)
    return buffer.getvalue()


def export_csv(processed: pd.DataFrame) -> bytes:
    buffer = io.BytesIO()
    processed.to_csv(buffer, index=False, encoding="utf-8-sig")
    buffer.seek(0)
    return buffer.getvalue()


def _autosize(workbook) -> None:
    """Best-effort column width adjustment for readability."""
    try:
        for ws in workbook.worksheets:
            for column_cells in ws.columns:
                length = max((len(str(c.value)) for c in column_cells if c.value is not None), default=8)
                ws.column_dimensions[column_cells[0].column_letter].width = min(max(length + 2, 10), 60)
    except Exception:
        pass  # cosmetics only — never fail an export because of widths
