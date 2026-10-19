"""Core logic for the Tag Name Generator.

Every module in this package is pure Python (pandas / openpyxl only) so it can
be unit-tested without starting the Streamlit UI.

Modules
-------
file_io        : reading Excel/CSV uploads and exporting results
abbreviations  : loading & cleaning the company abbreviation list
matcher        : tokenizing text and matching the longest approved phrases
tag_builder    : applying separators, casing, templates and stop words
validation     : duplicate / empty / invalid-character checks and reports
"""
