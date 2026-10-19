"""Tag-name assembly: separators, casing, templates and stop words.

The naming convention is fully configurable — nothing is hardcoded:
* separator      : '_', '-', '.', ' ' or any custom string
* casing         : UPPERCASE, lowercase, Title Case or keep as provided
* template       : e.g. ``{prefix}{value}{suffix}`` with optional
                   ``{col:Some Column}`` placeholders pulled from other
                   columns of the same row
* stop words     : small words like "of/the/for" removed from tag names
* unknown words  : kept verbatim (default) or replaced by a placeholder so
                   they can never be missed in review
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .matcher import MatchResult, normalize_text

CASE_OPTIONS = ("UPPERCASE", "lowercase", "Title Case", "Keep as-is")
DEFAULT_STOP_WORDS = ("of", "the", "and", "for", "in", "a", "an", "to", "at", "on", "with", "from", "by")
DEFAULT_TEMPLATE = "{prefix}{value}{suffix}"
DEFAULT_PLACEHOLDER = "UNK"


def apply_case(token: str, case: str) -> str:
    if case == "UPPERCASE":
        return token.upper()
    if case == "lowercase":
        return token.lower()
    if case == "Title Case":
        return token[:1].upper() + token[1:].lower() if token else token
    return token  # Keep as-is


@dataclass
class TagConfig:
    """Everything the user can configure about the naming convention."""

    separator: str = "_"
    case: str = "UPPERCASE"
    template: str = DEFAULT_TEMPLATE
    prefix: str = ""                       # e.g. a plant/site code the user types
    suffix: str = ""
    remove_stop_words: bool = True
    stop_words: List[str] = field(default_factory=lambda: list(DEFAULT_STOP_WORDS))
    unknown_word_policy: str = "keep"      # 'keep' | 'placeholder'
    unknown_placeholder: str = DEFAULT_PLACEHOLDER

    def stop_word_set(self) -> set:
        return {w.strip().lower() for w in self.stop_words if w.strip()}


def build_value_parts(result: MatchResult, config: TagConfig) -> List[str]:
    """Turn a MatchResult into the ordered pieces of the tag's 'value' part.

    Approved abbreviations get the configured casing; unknown words kept
    verbatim retain their original form so they stand out during review.
    """
    stop = config.stop_word_set() if config.remove_stop_words else set()
    unknown = set(result.unknown_words)
    parts: List[str] = []
    for p in result.parts:
        if p.lower() in stop:
            continue  # stop words go first — even unknown ones ("on", "the")
        if p in unknown:
            if config.unknown_word_policy == "placeholder":
                parts.append(apply_case(config.unknown_placeholder, config.case))
            else:
                parts.append(normalize_text(p))  # kept verbatim — never guessed
            continue
        parts.append(
            apply_case(normalize_text(p).replace(" ", config.separator), config.case)
        )

    # Guard: never produce an empty value because of stop-word removal.
    if not parts and result.parts:
        parts = [
            apply_case(normalize_text(p).replace(" ", config.separator), config.case)
            for p in result.parts
        ]

    return parts


def render_template(template: str, values: Dict[str, str], separator: str) -> str:
    """Substitute ``{key}`` / ``{col:Name}`` placeholders.

    ``{prefix}`` and ``{suffix}`` automatically carry the separator when they
    are non-empty, and empty segments are collapsed so ``{prefix}{value}``
    with no prefix never leaves a dangling separator.
    """
    text = template or DEFAULT_TEMPLATE

    prefix = values.get("prefix", "")
    suffix = values.get("suffix", "")
    text = text.replace("{prefix}", f"{prefix}{separator}" if prefix else "")
    text = text.replace("{suffix}", f"{separator}{suffix}" if suffix else "")

    def repl(m: re.Match) -> str:
        key = m.group(1).strip()
        if key.startswith("col:"):
            return values.get(("col", key[4:].strip()), "")
        return values.get(key, "")

    text = re.sub(r"\{([^{}]*)\}", repl, text)

    # Collapse doubled separators and trim edges.
    if separator:
        esc = re.escape(separator)
        text = re.sub(f"(?:{esc}){{2,}}", separator, text)
        text = re.sub(f"^(?:{esc})+|(?:{esc})+$", "", text)
    return text.strip()


def build_tag(
    result: MatchResult,
    config: TagConfig,
    row: Optional[Dict[str, object]] = None,
) -> str:
    """Create the final tag name for one matched value.

    ``row`` optionally provides the other columns of the current record so
    templates can reference them with ``{col:Column Name}`` placeholders.
    """
    parts = build_value_parts(result, config)
    value = config.separator.join(parts)

    values: Dict[str, str] = {
        "value": value,
        "prefix": apply_case(normalize_text(config.prefix), config.case),
        "suffix": apply_case(normalize_text(config.suffix), config.case),
    }
    if row:
        for col, raw in row.items():
            cleaned = normalize_text(raw)
            values[("col", str(col))] = apply_case(
                cleaned.replace(" ", config.separator), config.case
            )
    tag = render_template(config.template, values, config.separator)
    return tag


def build_tags(
    results: List[MatchResult],
    config: TagConfig,
    rows: Optional[List[Dict[str, object]]] = None,
) -> List[str]:
    """Vector-friendly wrapper used by the UI for a whole column."""
    if rows is None:
        rows = [None] * len(results)  # type: ignore[list-item]
    if len(rows) != len(results):
        raise ValueError("Number of rows must match number of match results.")
    return [build_tag(r, config, row) for r, row in zip(results, rows)]
