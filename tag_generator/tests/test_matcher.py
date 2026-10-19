"""Tests for core.matcher — tokenizing, single words, phrases, unknown words."""

import pytest

from core.matcher import (
    AbbreviationMatcher,
    MatchResult,
    collect_unknown_words,
    normalize_text,
    tokenize,
    unknown_words_examples,
)


@pytest.fixture
def matcher():
    return AbbreviationMatcher(
        {
            "pump": "P",
            "boiler": "BLR",
            "boiler feed pump": "BFP",
            "heat exchanger": "HX",
            "air cooled heat exchanger": "ACHE",
            "cooling tower": "CT",
            "fan": "FAN",
            "water": "W",
            "cooling water circulation pump": "CWCP",
        }
    )


class TestNormalization:
    def test_normalize_collapses_whitespace(self):
        assert normalize_text("  cooling    tower \t ") == "cooling tower"

    def test_normalize_handles_nan_and_none(self):
        assert normalize_text(None) == ""
        assert normalize_text(float("nan")) == ""
        assert normalize_text("nan") == ""

    def test_tokenize_splits_on_punctuation(self):
        assert tokenize("Cooling Tower / Fan-2") == ["cooling", "tower", "fan", "2"]

    def test_tokenize_empty(self):
        assert tokenize("") == []
        assert tokenize("   ") == []


class TestSingleWordMatching:
    def test_known_single_word(self, matcher):
        r = matcher.match("Boiler")
        assert r.parts == ["BLR"]
        assert r.unknown_words == []
        assert r.is_fully_matched

    def test_case_insensitive(self, matcher):
        assert matcher.match("PUMP").parts == ["P"]
        assert matcher.match("pump").parts == ["P"]

    def test_extra_spacing_and_punctuation(self, matcher):
        r = matcher.match("  Pump -- 2  ")
        assert r.parts == ["P", "2"]
        assert "2" in r.unknown_words  # numbers are not in the list

    def test_empty_value(self, matcher):
        r = matcher.match("")
        assert r.parts == []
        assert r.unknown_words == []
        assert not r.is_fully_matched


class TestPhraseMatching:
    def test_multiword_phrase(self, matcher):
        r = matcher.match("cooling tower")
        assert r.parts == ["CT"]
        assert r.matched_phrases == ["cooling tower"]

    def test_longest_phrase_wins(self, matcher):
        # 'air cooled heat exchanger' must beat 'heat exchanger'
        r = matcher.match("Air Cooled Heat Exchanger")
        assert r.parts == ["ACHE"]

    def test_shorter_phrase_when_longer_does_not_apply(self, matcher):
        r = matcher.match("shell and tube heat exchanger")
        # 'shell', 'and', 'tube' are unknown but 'heat exchanger' still matches
        assert r.parts[-1] == "HX"
        assert set(r.unknown_words) == {"shell", "and", "tube"}

    def test_longest_phrase_at_start_of_sentence(self, matcher):
        r = matcher.match("Boiler Feed Pump A")
        assert r.parts == ["BFP", "a"]
        assert r.unknown_words == ["a"]

    def test_phrase_with_unknown_tail(self, matcher):
        r = matcher.match("Cooling Tower Ventilation Duct")
        assert r.parts == ["CT", "ventilation", "duct"]
        assert r.unknown_words == ["ventilation", "duct"]

    def test_overlapping_phrases_longest_first(self, matcher):
        r = matcher.match("cooling water circulation pump")
        assert r.parts == ["CWCP"]


class TestUnknownWords:
    def test_unknown_word_kept_verbatim(self, matcher):
        r = matcher.match("Turbo Expander")
        assert r.parts == ["turbo", "expander"]
        assert r.unknown_words == ["turbo", "expander"]

    def test_unknown_words_are_never_invented(self, matcher):
        r = matcher.match("compressor")
        # no abbreviation exists -> original word is kept, not guessed
        assert r.parts == ["compressor"]
        assert r.unknown_words == ["compressor"]

    def test_collect_unknown_words_counts(self, matcher):
        results = [matcher.match(t) for t in ["duct fan", "duct pump", "boiler"]]
        counter = collect_unknown_words(results)
        assert counter["duct"] == 2
        assert "boiler" not in counter

    def test_unknown_words_examples(self, matcher):
        results = [matcher.match("duct fan"), matcher.match("duct pump")]
        examples = unknown_words_examples(results)
        assert examples["duct"] == "duct fan"


class TestMatcherConstruction:
    def test_empty_mapping(self):
        m = AbbreviationMatcher({})
        assert m.size == 0
        r = m.match("anything here")
        assert r.unknown_words == ["anything", "here"]

    def test_blank_rows_are_skipped(self):
        m = AbbreviationMatcher({"pump": "P", "": "X", "valve": "  "})
        assert m.size == 1

    def test_mapping_keys_are_normalized(self):
        m = AbbreviationMatcher({"  COOLING   Tower ": "CT"})
        assert m.match("cooling tower").parts == ["CT"]


class TestMatchResult:
    def test_is_fully_matched_false_when_unknown(self):
        r = MatchResult(source_text="x", parts=["x"], unknown_words=["x"])
        assert not r.is_fully_matched

    def test_is_fully_matched_false_when_empty(self):
        assert not MatchResult(source_text="").is_fully_matched
