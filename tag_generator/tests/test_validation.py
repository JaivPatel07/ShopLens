"""Tests for core.validation — duplicates, empties, invalid chars, reports."""

import pandas as pd

from core.matcher import AbbreviationMatcher
from core.validation import (
    ISSUE_DUPLICATE_TAG,
    ISSUE_EMPTY_SOURCE,
    ISSUE_EMPTY_TAG,
    ISSUE_INVALID_CHARS,
    ISSUE_UNKNOWN_WORDS,
    invalid_characters,
    status_per_row,
    unmatched_words_report,
    validate_tags,
)


def _series(values):
    return pd.Series(values, dtype="object")


class TestInvalidCharacters:
    def test_clean_tag(self):
        assert invalid_characters("CT_FAN_01", "_") == []

    def test_space_and_symbols_flagged(self):
        bad = invalid_characters("CT FAN #1", "_")
        assert " " in bad and "#" in bad

    def test_separator_is_allowed(self):
        assert invalid_characters("CT-FAN", "-") == []

    def test_empty_tag_has_no_invalid_chars(self):
        assert invalid_characters("", "_") == []


class TestValidateTags:
    def test_no_issues(self):
        issues = validate_tags(_series(["Cooling Tower Fan"]), _series(["CT_FAN"]))
        assert issues.empty

    def test_empty_source_flagged(self):
        issues = validate_tags(_series(["", None, "Fan"]), _series(["", "", "FAN"]))
        types = set(issues["Issue"])
        assert ISSUE_EMPTY_SOURCE in types
        # empty sources are not double-reported as other issues
        assert ISSUE_EMPTY_TAG not in types

    def test_empty_tag_flagged(self):
        issues = validate_tags(_series(["Fan"]), _series([""]))
        assert list(issues["Issue"]) == [ISSUE_EMPTY_TAG]

    def test_duplicate_flagged_on_every_row(self):
        issues = validate_tags(
            _series(["Boiler Feed Pump A", "Boiler Feed Pump B"]),
            _series(["BFP", "BFP"]),
        )
        dups = issues[issues["Issue"] == ISSUE_DUPLICATE_TAG]
        assert len(dups) == 2

    def test_invalid_characters_flagged(self):
        issues = validate_tags(_series(["Fan"]), _series(["FAN*1"]))
        assert ISSUE_INVALID_CHARS in set(issues["Issue"])

    def test_unknown_words_flagged(self):
        matcher = AbbreviationMatcher({"fan": "FAN"})
        results = [matcher.match("Cooling Fan")]
        issues = validate_tags(_series(["Cooling Fan"]), _series(["cooling_FAN"]), results)
        row = issues[issues["Issue"] == ISSUE_UNKNOWN_WORDS]
        assert len(row) == 1
        assert "cooling" in row.iloc[0]["Details"]

    def test_row_numbers_are_spreadsheet_style(self):
        issues = validate_tags(_series(["", "Fan"]), _series(["", "FAN"]))
        assert list(issues["Row"]) == [2]  # row 1 is the header


class TestUnmatchedWordsReport:
    def test_report_counts_and_examples(self):
        matcher = AbbreviationMatcher({"fan": "FAN"})
        results = [matcher.match("duct fan"), matcher.match("duct vent"), matcher.match("fan")]
        report = unmatched_words_report(results)
        assert list(report.columns) == ["Unknown Word", "Occurrences", "Example Source Text"]
        top = report.iloc[0]
        assert top["Unknown Word"] == "duct"
        assert top["Occurrences"] == 2
        assert top["Example Source Text"] == "duct fan"

    def test_empty_report_has_columns(self):
        matcher = AbbreviationMatcher({"fan": "FAN"})
        report = unmatched_words_report([matcher.match("fan")])
        assert report.empty
        assert "Unknown Word" in report.columns


class TestStatusPerRow:
    def test_statuses(self):
        matcher = AbbreviationMatcher({"fan": "FAN"})
        results = [matcher.match("fan"), matcher.match("duct fan"), matcher.match("")]
        statuses = status_per_row(results, ["FAN", "duct_FAN", ""], ["Fan", "Duct Fan", ""])
        assert statuses == ["OK", "Unknown words", "Empty source"]

    def test_duplicate_status(self):
        matcher = AbbreviationMatcher({"fan": "FAN"})
        results = [matcher.match("fan"), matcher.match("fan")]
        statuses = status_per_row(results, ["FAN", "FAN"], ["Fan", "Fan"])
        assert statuses == ["Duplicate", "Duplicate"]

    def test_invalid_chars_status(self):
        matcher = AbbreviationMatcher({"fan": "FAN"})
        results = [matcher.match("fan")]
        statuses = status_per_row(results, ["FAN*"], ["Fan"])
        assert statuses == ["Invalid chars"]
