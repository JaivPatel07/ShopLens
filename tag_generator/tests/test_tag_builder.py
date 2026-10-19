"""Tests for core.tag_builder — separators, casing, templates, stop words."""

import pytest

from core.matcher import AbbreviationMatcher
from core.tag_builder import TagConfig, apply_case, build_tag, build_tags, render_template


@pytest.fixture
def plain_matcher():
    return AbbreviationMatcher(
        {
            "cooling tower": "CT",
            "fan": "FAN",
            "boiler feed pump": "BFP",
            "safety valve": "SV",
            "steam": "STM",
            "drum": "DRM",
        }
    )


class TestCasing:
    def test_apply_case(self):
        assert apply_case("ct", "UPPERCASE") == "CT"
        assert apply_case("CT", "lowercase") == "ct"
        assert apply_case("cooling", "Title Case") == "Cooling"
        assert apply_case("Ct", "Keep as-is") == "Ct"


class TestSeparatorsAndCasing:
    def test_underscore_uppercase(self, plain_matcher):
        r = plain_matcher.match("Cooling Tower Fan")
        tag = build_tag(r, TagConfig(separator="_", case="UPPERCASE"))
        assert tag == "CT_FAN"

    def test_hyphen_lowercase(self, plain_matcher):
        r = plain_matcher.match("Cooling Tower Fan")
        tag = build_tag(r, TagConfig(separator="-", case="lowercase"))
        assert tag == "ct-fan"

    def test_dot_separator(self, plain_matcher):
        r = plain_matcher.match("Boiler Feed Pump")
        tag = build_tag(r, TagConfig(separator=".", case="UPPERCASE"))
        assert tag == "BFP"  # single phrase -> nothing to separate


class TestStopWords:
    def test_stop_words_removed(self, plain_matcher):
        r = plain_matcher.match("Safety Valve on Steam Drum")
        tag = build_tag(r, TagConfig(remove_stop_words=True))
        assert tag == "SV_STM_DRM"  # 'on' removed

    def test_stop_words_kept_when_disabled(self, plain_matcher):
        r = plain_matcher.match("Safety Valve on Steam Drum")
        tag = build_tag(r, TagConfig(remove_stop_words=False, unknown_word_policy="keep"))
        assert tag == "SV_on_STM_DRM"

    def test_all_stop_words_never_yields_empty(self, plain_matcher):
        r = plain_matcher.match("of the and")  # nothing approved here
        tag = build_tag(r, TagConfig(remove_stop_words=True))
        assert tag != ""


class TestPrefixSuffixTemplate:
    def test_prefix_and_suffix(self, plain_matcher):
        r = plain_matcher.match("Cooling Tower")
        config = TagConfig(prefix="ACME", suffix="01")
        assert build_tag(r, config) == "ACME_CT_01"

    def test_empty_prefix_leaves_no_dangling_separator(self, plain_matcher):
        r = plain_matcher.match("Cooling Tower")
        config = TagConfig(prefix="", suffix="01")
        assert build_tag(r, config) == "CT_01"

    def test_custom_template(self, plain_matcher):
        r = plain_matcher.match("Cooling Tower Fan")
        config = TagConfig(template="{prefix}{value}{suffix}", prefix="ZEN")
        assert build_tag(r, config) == "ZEN_CT_FAN"

    def test_template_with_column_reference(self, plain_matcher):
        r = plain_matcher.match("Cooling Tower Fan")
        config = TagConfig(template="{col:Plant Section}.{value}")
        row = {"Plant Section": "Utilities", "Other": "x"}
        assert build_tag(r, config, row) == "UTILITIES.CT_FAN"

    def test_render_template_collapses_separators(self):
        out = render_template("{prefix}_{value}_{suffix}", {"prefix": "", "value": "CT", "suffix": ""}, "_")
        assert out == "CT"


class TestUnknownWordPolicy:
    def test_unknown_word_kept(self, plain_matcher):
        r = plain_matcher.match("Cooling Tower Ventilation Duct")
        tag = build_tag(r, TagConfig(unknown_word_policy="keep"))
        assert tag == "CT_ventilation_duct"

    def test_unknown_word_placeholder(self, plain_matcher):
        r = plain_matcher.match("Cooling Tower Ventilation Duct")
        tag = build_tag(r, TagConfig(unknown_word_policy="placeholder", unknown_placeholder="UNK"))
        assert tag == "CT_UNK_UNK"

    def test_unknown_word_not_removed_as_stop_word(self, plain_matcher):
        # 'the' is a stop word but an unknown word list containing 'the'
        # must never silently drop information from an unmatched value.
        r = plain_matcher.match("Cooling Tower Theorem")
        tag = build_tag(r, TagConfig(unknown_word_policy="keep"))
        assert "theorem" in tag.lower()


class TestBuildTags:
    def test_batch_matches_single(self, plain_matcher):
        texts = ["Cooling Tower Fan", "Boiler Feed Pump", ""]
        results = [plain_matcher.match(t) for t in texts]
        tags = build_tags(results, TagConfig())
        assert tags == ["CT_FAN", "BFP", ""]

    def test_batch_with_rows(self, plain_matcher):
        results = [plain_matcher.match("Cooling Tower")]
        rows = [{"Plant Section": "Utilities"}]
        tags = build_tags(results, TagConfig(template="{col:Plant Section}_{value}"), rows)
        assert tags == ["UTILITIES_CT"]

    def test_batch_length_mismatch_raises(self, plain_matcher):
        with pytest.raises(ValueError):
            build_tags([plain_matcher.match("fan")], TagConfig(), rows=[{}, {}])
