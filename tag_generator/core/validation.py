"""Validation of generated tag names and reporting.

Checks performed (all reported, never silently fixed):
* empty source values and empty generated tags
* duplicate tag names (across the whole output)
* invalid characters for the chosen separator
* rows containing unknown (unmatched) words
"""

from __future__ import annotations

import re
from typing import List, Optional

import pandas as pd

from .matcher import MatchResult, collect_unknown_words, unknown_words_examples

ISSUE_EMPTY_SOURCE = "Empty source value"
ISSUE_EMPTY_TAG = "Empty tag generated"
ISSUE_DUPLICATE_TAG = "Duplicate tag name"
ISSUE_INVALID_CHARS = "Invalid characters"
ISSUE_UNKNOWN_WORDS = "Unknown word(s)"


def invalid_characters(tag: str, separator: str) -> List[str]:
    """Characters outside A-Z a-z 0-9 and the configured separator."""
    if not tag:
        return []
    allowed = re.compile(r"[^A-Za-z0-9" + re.escape(separator) + r"]")
    found = sorted(set(allowed.findall(tag)))
    return found


def validate_tags(
    originals: pd.Series,
    tags: pd.Series,
    results: Optional[List[MatchResult]] = None,
    separator: str = "_",
    tag_column_name: str = "Generated Tag",
) -> pd.DataFrame:
    """Return a tidy DataFrame of every validation issue found.

    Columns: Row (1-based, spreadsheet style), Issue, Details, Original Value,
    Generated Tag.
    """
    issues = []

    orig_list = list(originals)
    tag_list = list(tags)

    # Duplicates — count over the full output.
    tag_counts = pd.Series([t for t in tag_list if t], dtype="object").value_counts()
    dup_tags = set(tag_counts[tag_counts > 1].index)

    for idx, (orig, tag) in enumerate(zip(orig_list, tag_list)):
        row_no = idx + 2  # +1 for 0-based index, +1 for the header row
        orig_s = "" if orig is None or (isinstance(orig, float) and pd.isna(orig)) else str(orig)
        tag_s = "" if tag is None else str(tag)

        if not orig_s.strip():
            issues.append((row_no, ISSUE_EMPTY_SOURCE, "Source cell is empty", orig_s, tag_s))
            continue  # nothing else can be judged without a source
        if not tag_s.strip():
            issues.append((row_no, ISSUE_EMPTY_TAG, "Tag is empty after generation", orig_s, tag_s))
        if tag_s and tag_s in dup_tags:
            issues.append((row_no, ISSUE_DUPLICATE_TAG, f"'{tag_s}' appears more than once", orig_s, tag_s))
        bad = invalid_characters(tag_s, separator)
        if bad:
            issues.append(
                (row_no, ISSUE_INVALID_CHARS, "Unexpected characters: " + " ".join(repr(b) for b in bad), orig_s, tag_s)
            )
        if results is not None and idx < len(results) and results[idx].unknown_words:
            issues.append(
                (row_no, ISSUE_UNKNOWN_WORDS, "No approved abbreviation for: " + ", ".join(results[idx].unknown_words), orig_s, tag_s)
            )

    return pd.DataFrame(
        issues, columns=["Row", "Issue", "Details", "Original Value", tag_column_name]
    )


def unmatched_words_report(
    results: List[MatchResult],
) -> pd.DataFrame:
    """Word / Occurrences / Example table for the review screen & export."""
    counter = collect_unknown_words(results)
    examples = unknown_words_examples(results)
    if not counter:
        return pd.DataFrame(columns=["Unknown Word", "Occurrences", "Example Source Text"])
    rows = [
        (word, count, examples.get(word, ""))
        for word, count in counter.most_common()
    ]
    return pd.DataFrame(rows, columns=["Unknown Word", "Occurrences", "Example Source Text"])


def status_per_row(
    results: List[MatchResult], tags: List[str], originals: List[str], separator: str = "_"
) -> List[str]:
    """Short human status used to color-code the preview table."""
    tag_counts = pd.Series([t for t in tags if t], dtype="object").value_counts()
    statuses = []
    for r, tag, orig in zip(results, tags, originals):
        if not str(orig).strip():
            statuses.append("Empty source")
        elif not tag:
            statuses.append("Empty tag")
        elif invalid_characters(tag, separator):
            statuses.append("Invalid chars")
        elif tag in tag_counts and tag_counts[tag] > 1:
            statuses.append("Duplicate")
        elif r.unknown_words:
            statuses.append("Unknown words")
        else:
            statuses.append("OK")
    return statuses
