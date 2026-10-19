"""Industrial Tag Name Generator — Streamlit UI.

Run with:
    streamlit run app.py

The app walks the user through 8 steps:
  1. Upload the equipment data file (.xlsx / .csv)
  2. Upload the company abbreviation file
  3. Select the worksheet (Excel only)
  4. Select the column to process (dynamic dropdown — nothing is hardcoded)
  5. Configure the naming convention (separator, casing, template, stop words)
  6. Preview generated tag names side by side with the originals
  7. Review & fix unmatched abbreviations (add/edit/remove mappings)
  8. Export a NEW Excel file + validation report (the source file is never touched)
"""

from __future__ import annotations

import hashlib

import pandas as pd
import streamlit as st

from core import file_io
from core.abbreviations import clean_abbreviation_frame, guess_term_and_abbr_columns, split_mapping_text
from core.matcher import AbbreviationMatcher, normalize_text
from core.tag_builder import CASE_OPTIONS, DEFAULT_PLACEHOLDER, DEFAULT_STOP_WORDS, DEFAULT_TEMPLATE, TagConfig, build_tags
from core.validation import status_per_row, unmatched_words_report, validate_tags

# ---------------------------------------------------------------- constants
PREVIEW_ROW_LIMIT = 500          # rows shown in the browser (all rows are processed)
SEPARATOR_CHOICES = {
    "Underscore  ( _ )": "_",
    "Hyphen  ( - )": "-",
    "Dot  ( . )": ".",
    "Space  ( )": " ",
    "Custom…": "__custom__",
}
STATUS_COLORS = {
    "OK": "#d4f7d4",
    "Unknown words": "#ffe9b3",
    "Duplicate": "#ffd6d6",
    "Invalid chars": "#ffd6d6",
    "Empty tag": "#ffd6d6",
    "Empty source": "#e8e8e8",
}

st.set_page_config(page_title="Tag Name Generator", page_icon="🏷️", layout="wide")


# ---------------------------------------------------------------- caching
@st.cache_data(show_spinner=False)
def cached_sheets(file_id: str, file_bytes: bytes, filename: str):
    return file_io.list_sheets(file_bytes, filename)


@st.cache_data(show_spinner="Reading file…")
def cached_read(file_id: str, file_bytes: bytes, filename: str, sheet: str | None):
    return file_io.read_table(file_bytes, filename, sheet)


def file_id(uploaded) -> str:
    return hashlib.md5(uploaded.getvalue()).hexdigest()


# ---------------------------------------------------------------- helpers
def ss(key, default=None):
    if key not in st.session_state:
        st.session_state[key] = default
    return st.session_state[key]


def step_done(n: int) -> str:
    return "✅" if ss("steps_done", set()) and n in st.session_state.steps_done else "⬜"


def mark_done(n: int):
    st.session_state.setdefault("steps_done", set()).add(n)


def current_mapping() -> dict:
    """Company mapping (as edited in the UI) + quick-add entries."""
    mapping: dict = {}
    frame = ss("abbr_frame")
    if frame is not None and not frame.empty:
        for term, abbr in zip(frame["term"], frame["abbreviation"]):
            t, a = normalize_text(term), normalize_text(abbr)
            if t and a:
                mapping[t] = a
    mapping.update(ss("manual_entries", {}) or {})
    return mapping


def generate_everything():
    """Run matcher + tag builder + validation over ALL rows; store in session."""
    df: pd.DataFrame = st.session_state.df
    col = st.session_state.selected_column
    config: TagConfig = st.session_state.config
    matcher = AbbreviationMatcher(current_mapping())

    values = df[col].tolist()
    results = [matcher.match(v) for v in values]
    rows = df.astype(object).to_dict("records") if "{col:" in (config.template or "") else None
    tags = build_tags(results, config, rows)

    # Manual overrides (from the edit step) win over freshly generated tags.
    overrides = ss("manual_overrides", {}) or {}
    final_tags = [overrides.get(i, t) for i, t in enumerate(tags)]

    originals = [normalize_text(v) for v in values]
    statuses = status_per_row(results, final_tags, originals, config.separator)

    st.session_state.results = results
    st.session_state.tags = final_tags
    st.session_state.statuses = statuses
    st.session_state.unknown_report = unmatched_words_report(results)
    st.session_state.issues = validate_tags(
        pd.Series(originals, dtype="object"),
        pd.Series(final_tags, dtype="object"),
        results,
        config.separator,
        ss("output_column_name", "Generated Tag"),
    )
    st.session_state.matcher_size = matcher.size


# ---------------------------------------------------------------- sidebar
with st.sidebar:
    st.title("🏷️ Tag Name Generator")
    st.caption("Convert equipment names into standardized tag names using your company's abbreviation list.")
    st.markdown(
        f"""
        {step_done(1)} **1.** Upload equipment data  
        {step_done(2)} **2.** Upload abbreviation list  
        {step_done(3)} **3.** Select worksheet  
        {step_done(4)} **4.** Select column  
        {step_done(5)} **5.** Naming convention  
        {step_done(6)} **6.** Preview tags  
        {step_done(7)} **7.** Review unmatched words  
        {step_done(8)} **8.** Download results
        """
    )
    st.divider()
    st.caption(
        "Your uploaded files are **never modified** — all processing happens in "
        "memory and exports are written to new files."
    )
    if ss("manual_overrides", {}):
        if st.button("🧹 Clear manual tag edits"):
            st.session_state.manual_overrides = {}
            st.rerun()

st.header("Industrial Equipment Tag Name Generator")

# ============================================================ STEP 1 & 3
st.subheader(f"{step_done(1)} Step 1 — Upload the equipment data file")
up_equip = st.file_uploader(
    "Excel (.xlsx) or CSV (.csv) containing equipment names / sections / descriptions",
    type=["xlsx", "csv"],
    key="uploader_equip",
)

if up_equip is not None:
    fid = file_id(up_equip)
    try:
        sheets = cached_sheets(fid, up_equip.getvalue(), up_equip.name)
    except file_io.FileFormatError as exc:
        st.error(str(exc))
        st.stop()

    # ---- Step 3: worksheet selection (only when the workbook has several)
    sheet = None
    if len(sheets) > 1:
        st.subheader(f"{step_done(3)} Step 3 — Select the worksheet")
        sheet = st.selectbox("Worksheet", sheets, key="sheet_choice")
        mark_done(3)
    else:
        mark_done(3)

    try:
        df = cached_read(fid, up_equip.getvalue(), up_equip.name, sheet)
    except file_io.FileFormatError as exc:
        st.error(str(exc))
        st.stop()

    if df.empty:
        st.warning("The selected sheet/file contains no data rows.")
    st.session_state.df = df
    mark_done(1)
    c1, c2, c3 = st.columns(3)
    c1.metric("Rows", f"{len(df):,}")
    c2.metric("Columns", len(df.columns))
    c3.metric("File", up_equip.name)
    with st.expander("🔍 First rows of the uploaded file"):
        st.dataframe(df.head(10), width="stretch")
else:
    st.info("⬆️ Upload your equipment data file to begin.")
    st.stop()

# ============================================================ STEP 2
st.divider()
st.subheader(f"{step_done(2)} Step 2 — Upload the company abbreviation list")
up_abbr = st.file_uploader(
    "Excel (.xlsx) or CSV (.csv) with the official terms and their abbreviations",
    type=["xlsx", "csv"],
    key="uploader_abbr",
)

if up_abbr is not None:
    aid = file_id(up_abbr)
    try:
        abbr_sheets = cached_sheets(aid, up_abbr.getvalue(), up_abbr.name)
        abbr_sheet = abbr_sheets[0] if len(abbr_sheets) == 1 else st.selectbox(
            "Abbreviation file worksheet", abbr_sheets, key="abbr_sheet_choice"
        )
        abbr_raw = cached_read(aid, up_abbr.getvalue(), up_abbr.name, abbr_sheet)
    except file_io.FileFormatError as exc:
        st.error(str(exc))
        st.stop()

    guess_term, guess_abbr = guess_term_and_abbr_columns(list(abbr_raw.columns))
    g1, g2 = st.columns(2)
    term_col = g1.selectbox(
        "Which column contains the **full term / phrase**?",
        abbr_raw.columns,
        index=list(abbr_raw.columns).index(guess_term) if guess_term in abbr_raw.columns else 0,
        key="term_col_choice",
    )
    abbr_col = g2.selectbox(
        "Which column contains the **abbreviation**?",
        abbr_raw.columns,
        index=list(abbr_raw.columns).index(guess_abbr) if guess_abbr in abbr_raw.columns else min(1, len(abbr_raw.columns) - 1),
        key="abbr_col_choice",
    )
    if term_col == abbr_col:
        st.error("The term column and the abbreviation column must be different.")
        st.stop()

    try:
        abbr_list = clean_abbreviation_frame(abbr_raw, term_col, abbr_col)
    except ValueError as exc:
        st.error(str(exc))
        st.stop()

    if not abbr_list.duplicates.empty:
        st.warning(
            f"{len(abbr_list.duplicates)} rows contain duplicate terms — the first "
            "occurrence is used. Review them below."
        )
        with st.expander("Duplicate terms in the abbreviation file"):
            st.dataframe(abbr_list.duplicates, width="stretch")
    if abbr_list.empty_rows_dropped:
        st.caption(f"{abbr_list.empty_rows_dropped} empty row(s) were ignored.")

    st.markdown("**Approved abbreviations** — you can edit, add (last empty row) or delete rows here:")
    edited = st.data_editor(
        abbr_list.frame,
        num_rows="dynamic",
        width="stretch",
        key=f"abbr_editor_{aid}",
        column_config={
            "term": st.column_config.TextColumn("Term / phrase"),
            "abbreviation": st.column_config.TextColumn("Abbreviation"),
        },
    )
    st.session_state.abbr_frame = edited[edited["term"].notna() & edited["abbreviation"].notna()]
    mark_done(2)

    with st.expander("⚡ Bulk add mappings (paste lines like `cooling water = CW`)"):
        bulk = st.text_area("One mapping per line — `term = ABBR`, `term,ABBR` or `term<TAB>ABBR", key="bulk_add", height=100)
        if bulk.strip():
            parsed = split_mapping_text(bulk)
            if parsed:
                st.session_state.setdefault("manual_entries", {}).update(parsed)
                st.success(f"Added {len(parsed)} mapping(s) for this session. Regenerate the preview below.")
else:
    st.info("⬆️ Upload your company abbreviation list to continue.")
    st.stop()

# ============================================================ STEP 4
st.divider()
st.subheader(f"{step_done(4)} Step 4 — Select the column to process")
st.caption("All columns are read dynamically from your file — choose the one holding the names to convert. Every other column is preserved untouched.")
prev_sel = ss("selected_column")
columns = list(st.session_state.df.columns)
index = columns.index(prev_sel) if prev_sel in columns else 0
selected_column = st.selectbox("Column to convert into tag names", columns, index=index, key="column_choice")
st.session_state.selected_column = selected_column
mark_done(4)

non_empty = st.session_state.df[selected_column].map(lambda v: bool(normalize_text(v))).sum()
st.caption(f"{non_empty:,} of {len(st.session_state.df):,} rows in **{selected_column}** contain a value.")

# ============================================================ STEP 5
st.divider()
st.subheader(f"{step_done(5)} Step 5 — Configure the naming convention")

c1, c2 = st.columns(2)
sep_label = c1.selectbox("Separator between words", list(SEPARATOR_CHOICES.keys()), key="sep_choice")
case_choice = c2.radio("Letter casing", CASE_OPTIONS, horizontal=True, key="case_choice")

separator = SEPARATOR_CHOICES[sep_label]
if separator == "__custom__":
    separator = c1.text_input("Custom separator", value="_", max_chars=5, key="custom_sep")

with st.expander("🧩 Advanced — template, prefix / suffix, stop words, unknown-word policy"):
    t1, t2 = st.columns(2)
    prefix = t1.text_input("Fixed prefix (e.g. plant / site code)", value="", key="prefix_cfg",
                           help="Inserted where the template contains {prefix}.")
    suffix = t2.text_input("Fixed suffix", value="", key="suffix_cfg",
                           help="Inserted where the template contains {suffix}.")
    template = st.text_input(
        "Naming template",
        value=DEFAULT_TEMPLATE,
        key="template_cfg",
        help="{value} = converted name, {prefix}/{suffix} = fixed text, {col:Column Name} = value from another column of the same row.",
    )
    s1, s2 = st.columns([1, 2])
    remove_stop = s1.checkbox("Remove stop words", value=True, key="stop_cfg",
                              help="Drops small words like 'of', 'the', 'for' from tag names.")
    stop_words_csv = s2.text_input("Stop words (comma separated)", value=", ".join(DEFAULT_STOP_WORDS), key="stop_list_cfg")
    u1, u2 = st.columns(2)
    unknown_policy_label = u1.radio(
        "Unknown words (no approved abbreviation)",
        ["Keep the word as-is (highlighted for review)", "Insert a visible placeholder"],
        key="unknown_policy_cfg",
        help="The app never invents an abbreviation. Keeping the word preserves information; a placeholder makes gaps impossible to miss.",
    )
    placeholder = u2.text_input("Placeholder text", value=DEFAULT_PLACEHOLDER, key="placeholder_cfg")

config = TagConfig(
    separator=separator or "_",
    case=case_choice,
    template=template or DEFAULT_TEMPLATE,
    prefix=prefix,
    suffix=suffix,
    remove_stop_words=remove_stop,
    stop_words=[w.strip().lower() for w in stop_words_csv.split(",") if w.strip()],
    unknown_word_policy="keep" if unknown_policy_label.startswith("Keep") else "placeholder",
    unknown_placeholder=placeholder or DEFAULT_PLACEHOLDER,
)
st.session_state.config = config
mark_done(5)

example = config.separator.join(
    [p for p in (config.prefix, "CT", "FAN", config.suffix) if p]
)
st.caption(f"Example shape of a generated tag: `{example}`")

# ============================================================ STEP 6
st.divider()
st.subheader(f"{step_done(6)} Step 6 — Preview generated tag names")

generate_everything()
mark_done(6)

results = st.session_state.results
tags = st.session_state.tags
statuses = st.session_state.statuses
unknown_report: pd.DataFrame = st.session_state.unknown_report
issues: pd.DataFrame = st.session_state.issues

originals = [normalize_text(v) for v in st.session_state.df[selected_column]]
preview = pd.DataFrame(
    {
        "Row": range(2, len(originals) + 2),
        "Original Value": originals,
        st.session_state.get("output_column_name", "Generated Tag"): tags,
        "Status": statuses,
        "Unknown Words": [", ".join(r.unknown_words) for r in results],
    }
)

m1, m2, m3, m4 = st.columns(4)
m1.metric("Rows processed", f"{len(preview):,}")
m2.metric("Fully matched", f"{sum(1 for s in statuses if s == 'OK'):,}")
m3.metric("Rows with unknown words", f"{sum(1 for r in results if r.unknown_words):,}")
m4.metric("Duplicate tags", f"{int((preview['Status'] == 'Duplicate').sum()):,}")

only_problems = st.toggle("Show only rows with issues", value=False, key="only_problems")
shown = preview[preview["Status"] != "OK"] if only_problems else preview
if len(shown) > PREVIEW_ROW_LIMIT:
    st.caption(f"Showing the first {PREVIEW_ROW_LIMIT:,} rows — all {len(shown):,} are processed and exported.")
    shown = shown.head(PREVIEW_ROW_LIMIT)

def _row_colors(row: pd.Series):
    """Color the generated tag + status cells according to the row status."""
    color = STATUS_COLORS.get(row["Status"], "white")
    style = f"background-color: {color}" if row["Status"] != "OK" else ""
    return ["", "", style, style, ""]

styled = shown.style.apply(_row_colors, axis=1)
st.dataframe(styled, width="stretch", hide_index=True)

with st.expander(f"🧾 Validation issues ({len(issues):,})"):
    st.dataframe(issues if not issues.empty else pd.DataFrame({"Result": ["No issues 🎉"]}), width="stretch", hide_index=True)

# ============================================================ STEP 7
st.divider()
st.subheader(f"{step_done(7)} Step 7 — Review unmatched words")

if unknown_report.empty:
    st.success("Every word matched an approved abbreviation — nothing to review.")
    mark_done(7)
else:
    st.warning(
        f"{len(unknown_report)} distinct word(s) have no approved abbreviation. "
        "The app will **not** invent one — add the official mapping below, then the preview updates instantly."
    )
    st.dataframe(unknown_report, width="stretch", hide_index=True)

    a1, a2, a3 = st.columns([2, 1, 1])
    word = a1.selectbox("Unknown word", unknown_report["Unknown Word"].tolist(), key="unknown_pick")
    abbr_new = a2.text_input("Official abbreviation", key="abbr_new")
    if a3.button("➕ Add mapping", type="primary", disabled=not abbr_new.strip()):
        st.session_state.setdefault("manual_entries", {})[normalize_text(word)] = normalize_text(abbr_new)
        st.toast(f"Added: {word} → {abbr_new}")
        st.rerun()

    if st.session_state.get("manual_entries"):
        st.markdown("**Session mappings added by you** (not written back to your file):")
        st.dataframe(
            pd.DataFrame(sorted(st.session_state["manual_entries"].items()), columns=["Term", "Abbreviation"]),
            width="stretch",
            hide_index=True,
        )
        if st.button("🗑️ Remove all session mappings"):
            st.session_state.manual_entries = {}
            st.rerun()
    mark_done(7)

# ============================================================ STEP 8
st.divider()
st.subheader(f"{step_done(8)} Step 8 — Final edits & download")

out1, out2 = st.columns([2, 1])
output_mode = out1.radio(
    "How should the result be written?",
    ["Add a new column (original data preserved)", "Replace the selected column"],
    key="output_mode",
)
output_column_name = out1.text_input(
    "Name of the new column", value="Generated Tag", key="output_col_name_input",
    disabled=output_mode.startswith("Replace"),
)
st.session_state.output_column_name = (output_column_name or "").strip() or "Generated Tag"

st.markdown("**Manual corrections** — edit any tag directly in the table (edits are kept until you clear them in the sidebar):")
editor_input = pd.DataFrame(
    {
        "Row": range(2, len(originals) + 2),
        "Original Value": originals,
        "Generated Tag": tags,
    }
)
edited_preview = st.data_editor(
    editor_input,
    width="stretch",
    hide_index=True,
    disabled=["Row", "Original Value"],
    key="tag_edit_table",
    column_config={"Row": st.column_config.NumberColumn(format="%d")},
)
overrides = st.session_state.get("manual_overrides") or {}
st.session_state.manual_overrides = overrides
for pos, new_val in enumerate(edited_preview["Generated Tag"]):
    if str(new_val) != str(editor_input.at[pos, "Generated Tag"]):
        overrides[pos] = str(new_val)

final_tags = [overrides.get(i, t) for i, t in enumerate(tags)]

# Build the output frame: original columns preserved (+/- the tag column).
out_df = st.session_state.df.copy()
if output_mode.startswith("Replace"):
    out_df[selected_column] = final_tags
else:
    out_df[st.session_state.output_column_name] = final_tags

fmt = out2.radio("Export format", ["Excel (.xlsx) with reports", "CSV (data only)"], key="export_fmt")
download_name = "tags_" + ".".join(up_equip.name.split(".")[:-1]).replace(" ", "_")

final_issues = validate_tags(
    pd.Series(originals, dtype="object"),
    pd.Series(final_tags, dtype="object"),
    results,
    config.separator,
    st.session_state.output_column_name,
)

if fmt.startswith("Excel"):
    payload = file_io.export_workbook(out_df, final_issues, unknown_report)
    st.download_button(
        "⬇️ Download processed Excel file",
        data=payload,
        file_name=f"{download_name}_processed.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        type="primary",
        width="stretch",
    )
    st.caption("The workbook contains 3 sheets: **Processed Data**, **Validation Issues**, **Unmatched Words**.")
else:
    st.download_button(
        "⬇️ Download processed CSV",
        data=file_io.export_csv(out_df),
        file_name=f"{download_name}_processed.csv",
        mime="text/csv",
        type="primary",
        width="stretch",
    )
    report_bytes = file_io.export_workbook(pd.DataFrame(), final_issues, unknown_report)
    st.download_button(
        "⬇️ Download validation report (.xlsx)",
        data=report_bytes,
        file_name=f"{download_name}_report.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        width="stretch",
    )

mark_done(8)
st.success("Done — your original upload was never modified. Use the buttons above to download the results.")
