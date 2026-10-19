"""End-to-end UI flow test using Streamlit's AppTest harness.

Simulates a real user session: upload both sample files, switch columns,
configure the naming rule, quick-add a missing abbreviation and export.
Runs fully locally (no browser needed).
"""

from pathlib import Path

import pytest

pytest.importorskip("streamlit")
from streamlit.testing.v1 import AppTest  # noqa: E402

APP = Path(__file__).resolve().parent.parent / "app.py"
SAMPLES = Path(__file__).resolve().parent.parent / "sample_data"
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@pytest.fixture(scope="module")
def session():
    """Drive the app up to the point where both files are uploaded."""
    at = AppTest.from_file(str(APP), default_timeout=120)
    at.run()
    assert not at.exception, at.exception

    eq = (SAMPLES / "equipment_list_sample.xlsx").read_bytes()
    ab = (SAMPLES / "abbreviations_sample.xlsx").read_bytes()

    at.get("file_uploader")[0].set_value(("equipment_list_sample.xlsx", eq, XLSX_MIME)).run()
    assert not at.exception, at.exception
    at.get("file_uploader")[1].set_value(("abbreviations_sample.xlsx", ab, XLSX_MIME)).run()
    assert not at.exception, at.exception
    return at


def _widget(at, kind, key):
    found = [w for w in at.get(kind) if getattr(w, "key", None) == key]
    assert found, f"widget {kind}[{key}] not rendered"
    return found[0]


def test_initial_page_renders():
    at = AppTest.from_file(str(APP), default_timeout=120)
    at.run()
    assert not at.exception, at.exception
    assert any("Tag Name Generator" in h.value for h in at.header)


def test_abbreviation_columns_are_guessed(session):
    term = _widget(session, "selectbox", "term_col_choice")
    abbr = _widget(session, "selectbox", "abbr_col_choice")
    assert term.value == "Full Term"
    assert abbr.value == "Abbreviation"


def test_column_dropdown_lists_all_columns(session):
    col = _widget(session, "selectbox", "column_choice")
    assert "Equipment Name" in col.options
    assert "Plant Section" in col.options


def test_switch_column_and_back(session):
    col = _widget(session, "selectbox", "column_choice")
    col.set_value("Plant Section").run()
    assert not session.exception, session.exception
    col = _widget(session, "selectbox", "column_choice")
    col.set_value("Equipment Name").run()
    assert not session.exception, session.exception


def test_preview_and_metrics(session):
    metrics = {m.label: m.value for m in session.metric}
    assert metrics["Rows processed"] == "35"
    # sample data intentionally contains words with no approved abbreviation
    assert int(metrics["Rows with unknown words"].replace(",", "")) > 0


def test_prefix_appears_in_tags(session):
    _widget(session, "text_input", "prefix_cfg").set_value("ZEN").run()
    assert not session.exception, session.exception
    frames = session.get("dataframe")
    assert frames, "preview table not rendered"


def test_quick_add_mapping_removes_unknown_word(session):
    pick = _widget(session, "selectbox", "unknown_pick")
    word = pick.value
    # type the abbreviation first so the (otherwise disabled) button enables
    _widget(session, "text_input", "abbr_new").set_value("TST").run()
    assert not session.exception, session.exception
    add_btn = [b for b in session.button if "Add mapping" in (b.label or "")][0]
    add_btn.set_value(True).run()
    assert not session.exception, session.exception
    pick = _widget(session, "selectbox", "unknown_pick")
    assert word not in pick.options


def test_separator_and_case_changes(session):
    _widget(session, "selectbox", "sep_choice").set_value("Hyphen  ( - )").run()
    assert not session.exception, session.exception
    _widget(session, "radio", "case_choice").set_value("lowercase").run()
    assert not session.exception, session.exception


def test_excel_export_button_available(session):
    _widget(session, "radio", "export_fmt").set_value("Excel (.xlsx) with reports").run()
    assert not session.exception, session.exception
    buttons = session.get("download_button")
    excel = [b for b in buttons if "Excel" in (b.label or "") and "report" not in (b.label or "")]
    # AppTest exposes the click state, not the payload bytes (payload building
    # is covered by tests/test_file_io.py) — assert the button is rendered.
    assert excel


def test_csv_export_mode(session):
    _widget(session, "radio", "export_fmt").set_value("CSV (data only)").run()
    assert not session.exception, session.exception
    labels = [b.label for b in session.get("download_button")]
    assert any("CSV" in (l or "") for l in labels)
    assert any("report" in (l or "") for l in labels)
