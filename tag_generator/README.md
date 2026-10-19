# 🏷️ Industrial Tag Name Generator

Convert equipment names, plant sections and descriptions into standardized
tag names (e.g. `ZEN_CT_FAN_01`) using **your company's official abbreviation
list** — instead of editing hundreds of rows by hand.

* Built with **Python + Streamlit + pandas + openpyxl** — runs 100 % locally.
* **No paid APIs, no external AI services, no cloud uploads.**
* Your source files are **never modified**; results are written to new files.
* Nothing is hardcoded: columns, sheets, separators, casing and naming
  templates are all detected or configured at runtime.
* The app **never invents abbreviations** — words without an approved
  abbreviation are highlighted for your review.

---

## Project structure

```
tag_generator/
├── app.py                     # Streamlit UI (the 8-step wizard)
├── requirements.txt           # Python dependencies
├── conftest.py                # makes `core` importable for pytest
├── core/                      # pure-Python logic (unit-testable, no UI)
│   ├── file_io.py             #   read .xlsx/.csv, list sheets, export reports
│   ├── abbreviations.py       #   load/clean abbreviation list, guess columns
│   ├── matcher.py             #   tokenize + longest-phrase-first matching
│   ├── tag_builder.py         #   separators, casing, templates, stop words
│   └── validation.py          #   duplicates / empties / invalid chars / reports
├── sample_data/               # fictional sample files for testing
│   ├── equipment_list_sample.xlsx / .csv
│   └── abbreviations_sample.xlsx / .csv
├── scripts/
│   └── make_sample_data.py    # regenerates the sample files
└── tests/                     # 90+ pytest cases (logic + full UI flow)
```

---

## Installation (Windows, step by step)

1. **Install Python 3.10 or newer** from <https://www.python.org/downloads/>.
   During installation, tick **“Add python.exe to PATH”**.
2. **Open a terminal**: press `Win + R`, type `cmd`, press Enter
   (or search “Command Prompt” in the Start menu).
3. **Go to the project folder**, e.g.:
   ```bat
   cd C:\path\to\tag_generator
   ```
4. **Create a virtual environment** (once):
   ```bat
   python -m venv venv
   ```
5. **Activate it** (each time you work on the project):
   ```bat
   venv\Scripts\activate
   ```
   You should now see `(venv)` at the start of the prompt.
6. **Install the dependencies**:
   ```bat
   pip install -r requirements.txt
   ```
7. **Start the app**:
   ```bat
   streamlit run app.py
   ```
   Your browser opens automatically at <http://localhost:8501>. If it does
   not, copy the URL printed in the terminal into your browser.
8. **Stop the app** later with `Ctrl + C` in the terminal.

> **Linux / macOS** — identical, except step 5 is `source venv/bin/activate`.

### Run the tests (optional)

```bat
venv\Scripts\activate
python -m pytest tests -v
```

---

## Using the app (8 steps)

| Step | What you do | What the app does |
|-----:|-------------|-------------------|
| 1 | Upload the equipment data file (`.xlsx` or `.csv`) | Reads it into memory, shows row/column counts and a preview. Column names are read dynamically. |
| 2 | Upload the company abbreviation list | Guesses which columns hold *Term* and *Abbreviation* (you can override with the dropdowns). Duplicates and empty rows are reported. The mapping table is editable — add, change or delete entries; the edits live in the session only and never touch your file. |
| 3 | Select the worksheet *(Excel files with several sheets only)* | Loads just that sheet. |
| 4 | Select the column to process | Any column can be picked and re-picked at any time. All other columns are preserved untouched. |
| 5 | Configure the naming convention | Separator (`_ - . space` or custom), casing (UPPER / lower / Title / as-is), fixed prefix (e.g. a plant code) and suffix, stop-word removal (editable list), a naming **template**, and the unknown-word policy (keep word vs. visible placeholder). |
| 6 | Preview | Original vs. generated tag side by side for **all** rows, color-coded: green OK, amber unknown words, red duplicates / invalid characters / empty tags, plus metrics and a full validation-issue table. |
| 7 | Review unmatched words | Every word with no approved abbreviation is listed with its occurrence count and an example sentence. Add the official abbreviation with two clicks — the preview regenerates instantly. Bulk paste (`term = ABBR` per line) is supported in step 2. |
| 8 | Download | Edit any individual tag directly in the table, choose **add new column** (default, originals preserved) or **replace the selected column**, then download a new `.xlsx` with three sheets — *Processed Data*, *Validation Issues*, *Unmatched Words* — or a `.csv` plus a separate report workbook. |

### Naming template placeholders (step 5, advanced)

| Placeholder | Meaning |
|-------------|---------|
| `{value}`   | the converted equipment name (default template: `{prefix}{value}{suffix}`) |
| `{prefix}` / `{suffix}` | the fixed texts you enter; separators are inserted automatically and empty segments never leave dangling separators |
| `{col:Plant Section}` | value of another column of the same row, e.g. `{col:Plant Section}_{value}` → `UTILITIES_CT_FAN` |

### Matching rules (what the engine guarantees)

* Case, spacing and punctuation in the source never matter
  (`cooling   tower/fan` = `Cooling Tower Fan`).
* **Longest approved phrase wins**: with `heat exchanger → HX` and
  `air cooled heat exchanger → ACHE`, the text “Air Cooled Heat Exchanger”
  becomes `ACHE`, not `AC HX`.
* Words without an approved abbreviation are **kept verbatim** (or replaced
  by the placeholder you configure) and reported — never guessed.

---

## Try it with the sample data

All sample files are **fictional** (imaginary “Zenith Power Works”):

1. Start the app, upload `sample_data/equipment_list_sample.xlsx`.
2. Upload `sample_data/abbreviations_sample.xlsx` — the column guesser should
   pick *Full Term* / *Abbreviation* automatically.
3. Choose the column **Equipment Name**.
4. Leave the defaults (separator `_`, UPPERCASE) or type a prefix like `ZEN`.
5. Look at the preview: rows like *“Ventilation Duct Fan”* show amber because
   `ventilation` and `duct` have no approved abbreviation.
6. In step 7 add e.g. `ventilation = VENT` and `duct = DCT` and watch the tags
   complete themselves.
7. Download the result and open the *Validation Issues* / *Unmatched Words*
   sheets.

Regenerate the samples any time with:

```bat
python scripts\make_sample_data.py
```

---

## Handling big / messy files

* Reading and matching are vectorized in pandas; only the on-screen preview is
  capped (first 500 rows shown — **all** rows are processed and exported).
* Missing values, duplicate rows, inconsistent spacing and mixed casing are
  handled explicitly and surfaced in the validation report.
* Corrupt, password-protected, empty or unsupported files produce clear
  on-screen error messages instead of stack traces.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `streamlit` is not recognized | Activate the venv (step 5) or run `python -m streamlit run app.py`. |
| Old `.xls` file rejected | Re-save it as `.xlsx` in Excel. |
| Port 8501 already in use | Run `streamlit run app.py --server.port 8600`. |
| Wrong columns guessed in the abbreviation file | Use the two dropdowns above the mapping table to pick them manually. |
