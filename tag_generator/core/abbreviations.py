"""Loading and cleaning the company abbreviation list.

Nothing about the file layout is hardcoded: the two relevant columns
(the full term and its abbreviation) are *guessed* from header keywords and
the user can always override the guess in the UI.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import pandas as pd

from .matcher import normalize_text, tokenize

# Header keywords used only to *suggest* which column is which.
_TERM_HINTS = ("term", "word", "phrase", "name", "description", "full", "equipment", "text", "meaning")
_ABBR_HINTS = ("abbr", "abbrev", "short", "code", "acronym", "symbol", "tag", "alias")


@dataclass
class AbbreviationList:
    """A cleaned abbreviation table plus helpers."""

    frame: pd.DataFrame           # columns: term, abbreviation (original casing kept)
    duplicates: pd.DataFrame      # terms that appeared more than once
    empty_rows_dropped: int = 0

    def to_mapping(self) -> Dict[str, str]:
        """``{normalized phrase: abbreviation}`` for the matcher.

        Keys are lowercased and token-joined so casing/spacing never matters.
        """
        mapping: Dict[str, str] = {}
        for term, abbr in zip(self.frame["term"], self.frame["abbreviation"]):
            key = " ".join(tokenize(term))
            if key:
                mapping[key] = normalize_text(abbr)
        return mapping

    def token_count(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for term in self.frame["term"]:
            counts[normalize_text(term)] = len(tokenize(term))
        return counts


def guess_term_and_abbr_columns(columns: List[str]) -> Tuple[Optional[str], Optional[str]]:
    """Suggest which uploaded columns hold the term and the abbreviation.

    Scoring is keyword based; returns ``(None, None)`` pieces when unsure so
    the UI can simply ask the user.
    """

    def score(col: str, hints: Tuple[str, ...]) -> int:
        c = col.lower()
        score_ = 0
        for rank, hint in enumerate(hints):
            if hint in c:
                score_ += 100 - rank  # earlier hints are stronger
        return score_

    term_scores = {c: score(c, _TERM_HINTS) for c in columns}
    abbr_scores = {c: score(c, _ABBR_HINTS) for c in columns}

    abbr_col = max(abbr_scores, key=abbr_scores.get) if abbr_scores and max(abbr_scores.values()) > 0 else None
    remaining = [c for c in columns if c != abbr_col]
    term_col = None
    if remaining:
        term_scores = {c: score(c, _TERM_HINTS) for c in remaining}
        best = max(term_scores, key=term_scores.get)
        if term_scores[best] > 0:
            term_col = best
        elif len(columns) == 2 and abbr_col is not None:
            term_col = remaining[0]  # two-column file: the other one is the term
        elif abbr_col is None and len(columns) == 2:
            return columns[0], columns[1]
    return term_col, abbr_col


def clean_abbreviation_frame(
    df: pd.DataFrame, term_col: str, abbr_col: str
) -> AbbreviationList:
    """Build a clean ``term / abbreviation`` frame from any uploaded table.

    * strips whitespace, drops rows where either side is empty
    * keeps original casing (the tag builder applies casing rules later)
    * reports duplicate terms instead of silently choosing one
    """
    if term_col not in df.columns or abbr_col not in df.columns:
        raise ValueError(
            f"Column(s) not found in the abbreviation file: "
            f"'{term_col}' / '{abbr_col}'. Available: {list(df.columns)}"
        )

    work = pd.DataFrame(
        {
            "term": df[term_col].map(normalize_text),
            "abbreviation": df[abbr_col].map(normalize_text),
        }
    )
    total = len(work)
    work = work[(work["term"] != "") & (work["abbreviation"] != "")]
    empty_rows = total - len(work)

    # Duplicate detection on the normalized term (case/spacing insensitive).
    work["_key"] = work["term"].map(lambda t: " ".join(tokenize(t)))
    dup_mask = work.duplicated(subset="_key", keep=False)
    duplicates = work.loc[dup_mask, ["term", "abbreviation"]].sort_values("term")

    # First occurrence wins so matching stays deterministic.
    work = work.drop_duplicates(subset="_key", keep="first").drop(columns="_key")
    work = work.sort_values("term").reset_index(drop=True)
    return AbbreviationList(frame=work, duplicates=duplicates, empty_rows_dropped=empty_rows)


def mapping_from_manual_entries(entries: Dict[str, str]) -> Dict[str, str]:
    """Normalize a dict of user-entered mappings (UI 'quick add' form).

    Keys are lowercased/token-joined like :meth:`AbbreviationList.to_mapping`.
    """
    clean: Dict[str, str] = {}
    for term, abbr in entries.items():
        key = " ".join(tokenize(term))
        a = normalize_text(abbr)
        if key and a:
            clean[key] = a
    return clean


def split_mapping_text(text: str) -> Dict[str, str]:
    """Parse a pasted block of ``term = abbr`` / ``term,abbr`` lines."""
    out: Dict[str, str] = {}
    for line in re.split(r"[\n;]+", text or ""):
        line = line.strip()
        if not line:
            continue
        parts = re.split(r"\s*(?:=|,|\t)\s*| {2,}", line, maxsplit=1)
        if len(parts) == 2 and parts[0].strip() and parts[1].strip():
            out[normalize_text(parts[0])] = normalize_text(parts[1])
    return out
