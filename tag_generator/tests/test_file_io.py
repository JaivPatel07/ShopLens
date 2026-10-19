"""Tests for core.file_io — reading, sheet listing and exporting."""

import io

import pandas as pd
import pytest

from core import file_io
from core.file_io import FileFormatError


@pytest.fixture
def sample_df():
    return pd.DataFrame(
        {
            "Equipment Name": ["Cooling Tower Fan", "Boiler Feed Pump"],
            "Plant Section": ["Utilities", "Boiler Island"],
        }
    )


def _xlsx_bytes(df: pd.DataFrame, sheet: str = "Sheet1") -> bytes:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name=sheet, index=False)
    return buf.getvalue()


def _csv_bytes(df: pd.DataFrame, sep: str = ",", encoding: str = "utf-8") -> bytes:
    return df.to_csv(index=False, sep=sep).encode(encoding)


class TestListSheets:
    def test_csv_single_table(self, sample_df):
        assert file_io.list_sheets(_csv_bytes(sample_df), "data.csv") == ["CSV (single table)"]

    def test_xlsx_sheet_names(self, sample_df):
        names = file_io.list_sheets(_xlsx_bytes(sample_df, "Equipment"), "data.xlsx")
        assert names == ["Equipment"]

    def test_unsupported_extension(self):
        with pytest.raises(FileFormatError, match="Unsupported"):
            file_io.list_sheets(b"xx", "data.txt")

    def test_corrupt_xlsx_message(self):
        with pytest.raises(FileFormatError, match="valid"):
            file_io.list_sheets(b"not an excel file", "broken.xlsx")


class TestReadTable:
    def test_read_csv(self, sample_df):
        df = file_io.read_table(_csv_bytes(sample_df), "data.csv")
        assert list(df.columns) == ["Equipment Name", "Plant Section"]
        assert len(df) == 2

    def test_read_xlsx_with_sheet(self, sample_df):
        df = file_io.read_table(_xlsx_bytes(sample_df, "Tags"), "data.xlsx", sheet="Tags")
        assert len(df) == 2

    def test_read_xlsx_missing_sheet_message(self, sample_df):
        with pytest.raises(FileFormatError, match="could not be found"):
            file_io.read_table(_xlsx_bytes(sample_df), "data.xlsx", sheet="Nope")

    def test_column_names_trimmed_and_deduped(self):
        raw = b" Name , Name ,Value\n a , b ,1\n"
        df = file_io.read_table(raw, "data.csv")
        assert list(df.columns) == ["Name", "Name (1)", "Value"]

    def test_empty_csv_message(self):
        with pytest.raises(FileFormatError, match="empty"):
            file_io.read_table(b"", "empty.csv")

    def test_unsupported_extension(self):
        with pytest.raises(FileFormatError, match="Unsupported"):
            file_io.read_table(b"xx", "data.pdf")

    def test_semicolon_csv(self, sample_df):
        df = file_io.read_table(_csv_bytes(sample_df, sep=";"), "data.csv")
        assert list(df.columns) == ["Equipment Name", "Plant Section"]


class TestExport:
    def test_export_workbook_has_three_sheets(self, sample_df):
        issues = pd.DataFrame({"Row": [2], "Issue": ["Duplicate tag name"], "Details": ["x"],
                               "Original Value": ["a"], "Generated Tag": ["b"]})
        unknown = pd.DataFrame({"Unknown Word": ["duct"], "Occurrences": [1],
                                "Example Source Text": ["duct fan"]})
        payload = file_io.export_workbook(sample_df, issues, unknown)
        result = pd.read_excel(io.BytesIO(payload), sheet_name=None, engine="openpyxl")
        assert set(result.keys()) == {"Processed Data", "Validation Issues", "Unmatched Words"}
        assert len(result["Processed Data"]) == 2
        assert result["Validation Issues"].iloc[0]["Issue"] == "Duplicate tag name"

    def test_export_workbook_empty_reports(self, sample_df):
        payload = file_io.export_workbook(sample_df, pd.DataFrame(), pd.DataFrame())
        result = pd.read_excel(io.BytesIO(payload), sheet_name=None, engine="openpyxl")
        assert "No validation issues found" in str(result["Validation Issues"].iloc[0, 0])

    def test_export_csv_roundtrip(self, sample_df):
        payload = file_io.export_csv(sample_df)
        back = pd.read_csv(io.BytesIO(payload))
        assert back.equals(sample_df)
