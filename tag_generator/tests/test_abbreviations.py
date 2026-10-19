"""Tests for core.abbreviations — loading, cleaning and column guessing."""

import pandas as pd
import pytest

from core.abbreviations import (
    clean_abbreviation_frame,
    guess_term_and_abbr_columns,
    mapping_from_manual_entries,
    split_mapping_text,
)


@pytest.fixture
def raw_frame():
    return pd.DataFrame(
        {
            "Full Term": ["  Cooling Tower ", "Pump", "Boiler Feed Pump", None, "Fan"],
            "Abbreviation": ["CT", "P", "BFP", "X", " FAN "],
        }
    )


class TestColumnGuessing:
    def test_guesses_common_headers(self):
        term, abbr = guess_term_and_abbr_columns(["Full Term", "Abbreviation"])
        assert term == "Full Term"
        assert abbr == "Abbreviation"

    def test_guesses_alternate_headers(self):
        term, abbr = guess_term_and_abbr_columns(["Description", "Short Code"])
        assert term == "Description"
        assert abbr == "Short Code"

    def test_two_column_file_without_hints(self):
        term, abbr = guess_term_and_abbr_columns(["ColA", "ColB"])
        assert (term, abbr) == ("ColA", "ColB")

    def test_no_guess_returns_none(self):
        term, _ = guess_term_and_abbr_columns(["ColA", "ColB", "ColC"])
        assert term is None  # UI will ask the user


class TestCleaning:
    def test_strips_whitespace(self, raw_frame):
        cleaned = clean_abbreviation_frame(raw_frame, "Full Term", "Abbreviation")
        assert "Cooling Tower" in list(cleaned.frame["term"])
        assert "FAN" in list(cleaned.frame["abbreviation"])

    def test_drops_empty_rows(self, raw_frame):
        cleaned = clean_abbreviation_frame(raw_frame, "Full Term", "Abbreviation")
        assert cleaned.empty_rows_dropped == 1
        assert "" not in list(cleaned.frame["term"])

    def test_duplicates_are_reported(self):
        df = pd.DataFrame({"t": ["pump", " Pump ", "valve"], "a": ["P", "PU", "V"]})
        cleaned = clean_abbreviation_frame(df, "t", "a")
        assert len(cleaned.duplicates) == 2
        # first occurrence wins deterministically
        mapping = cleaned.to_mapping()
        assert mapping["pump"] == "P"

    def test_missing_column_raises_clear_error(self, raw_frame):
        with pytest.raises(ValueError, match="not found"):
            clean_abbreviation_frame(raw_frame, "Nope", "Abbreviation")

    def test_to_mapping_for_matcher(self, raw_frame):
        cleaned = clean_abbreviation_frame(raw_frame, "Full Term", "Abbreviation")
        mapping = cleaned.to_mapping()
        assert mapping["cooling tower"] == "CT"
        assert mapping["boiler feed pump"] == "BFP"


class TestManualEntries:
    def test_manual_entries_normalized(self):
        entries = mapping_from_manual_entries({"  Duct ": " DCT ", "": "X", "Fan": ""})
        assert entries == {"duct": "DCT"}

    def test_split_mapping_text_equals(self):
        parsed = split_mapping_text("cooling water = CW\nsteam=STM")
        assert parsed == {"cooling water": "CW", "steam": "STM"}

    def test_split_mapping_text_comma_and_tab(self):
        parsed = split_mapping_text("fire water, FWTR\ndeaerator\tDA")
        assert parsed == {"fire water": "FWTR", "deaerator": "DA"}

    def test_split_mapping_text_ignores_junk(self):
        assert split_mapping_text("nonsense\n\n   ") == {}
