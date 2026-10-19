"""Text tokenizing and abbreviation matching.

The matcher never invents abbreviations:
* Every approved phrase (one or more words) is looked up as-is.
* The LONGEST matching phrase always wins (e.g. "boiler feed pump" beats
  "boiler" + "feed" + "pump").
* Any word that has no approved abbreviation is reported as *unknown* and can
  be kept verbatim in the tag (default) or replaced by a visible placeholder.
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Dict, List, Tuple

# A token is a run of letters/digits. Punctuation and spaces act as separators
# (they are dropped because the tag builder inserts its own separator).
_TOKEN_RE = re.compile(r"[A-Za-z0-9]+")


def normalize_text(text: object) -> str:
    """Trim and collapse internal whitespace; convert NaN/None to ''."""
    if text is None:
        return ""
    s = str(text)
    if s.lower() in ("nan", "none", "nat"):
        return ""
    return re.sub(r"\s+", " ", s).strip()


def tokenize(text: object) -> List[str]:
    """Split text into lowercase alphanumeric tokens.

    >>> tokenize("  Cooling   Tower / Fan-2 ")
    ['cooling', 'tower', 'fan', '2']
    """
    return _TOKEN_RE.findall(normalize_text(text).lower())


@dataclass
class MatchResult:
    """Outcome of matching one piece of text against the abbreviation map."""

    source_text: str                      # normalized original text
    parts: List[str] = field(default_factory=list)   # abbreviations + kept words
    matched_phrases: List[str] = field(default_factory=list)  # phrases that hit
    unknown_words: List[str] = field(default_factory=list)    # words with no abbr.

    @property
    def is_fully_matched(self) -> bool:
        return bool(self.parts) and not self.unknown_words


class AbbreviationMatcher:
    """Greedy longest-phrase-first matcher built from a company mapping.

    Parameters
    ----------
    mapping : dict
        ``{"full phrase": "ABBR"}`` — keys may contain multiple words and any
        casing/spacing; they are normalized internally.
    """

    def __init__(self, mapping: Dict[str, str]):
        self._map: Dict[Tuple[str, ...], str] = {}
        for phrase, abbr in mapping.items():
            tokens = tuple(tokenize(phrase))
            abbr_clean = normalize_text(abbr)
            if not tokens or not abbr_clean:
                continue  # skip empty rows silently; UI shows them separately
            self._map[tokens] = abbr_clean
        self.max_phrase_len = max((len(k) for k in self._map), default=1)

    @property
    def size(self) -> int:
        return len(self._map)

    def phrases(self) -> List[str]:
        return sorted(" ".join(k) for k in self._map)

    def match(self, text: object) -> MatchResult:
        """Match one value; returns abbreviations, hits and unknown words."""
        source = normalize_text(text)
        tokens = tokenize(source)
        result = MatchResult(source_text=source)
        if not tokens:
            return result

        i = 0
        n = len(tokens)
        while i < n:
            longest = min(self.max_phrase_len, n - i)
            hit = None
            for length in range(longest, 1, -1):  # try multi-word phrases first
                candidate = tuple(tokens[i : i + length])
                if candidate in self._map:
                    hit = (candidate, self._map[candidate])
                    break
            if hit:
                phrase, abbr = hit
                result.parts.append(abbr)
                result.matched_phrases.append(" ".join(phrase))
                i += len(phrase)
            else:
                # Single-word abbreviation?
                single = (tokens[i],)
                if single in self._map:
                    result.parts.append(self._map[single])
                    result.matched_phrases.append(tokens[i])
                else:
                    # Unknown word — keep it verbatim so nothing is invented.
                    result.parts.append(tokens[i])
                    result.unknown_words.append(tokens[i])
                i += 1
        return result


def collect_unknown_words(results: List[MatchResult]) -> Counter:
    """Aggregate unknown words across many results, with example sentences."""
    counter: Counter = Counter()
    for r in results:
        counter.update(r.unknown_words)
    return counter


def unknown_words_examples(results: List[MatchResult]) -> Dict[str, str]:
    """First source text in which each unknown word appeared."""
    examples: Dict[str, str] = {}
    for r in results:
        for w in r.unknown_words:
            examples.setdefault(w, r.source_text)
    return examples
