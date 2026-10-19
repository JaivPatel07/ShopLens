"""Generate the fictional sample files used for testing the app.

Run once from the project root:
    python scripts/make_sample_data.py

All company names, equipment and abbreviations below are FICTIONAL.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

SAMPLE_DIR = Path(__file__).resolve().parent.parent / "sample_data"


EQUIPMENT_ROWS = [
    # (Equipment Name, Plant Section, Service / Description, Existing Tag)
    ("Cooling Tower Fan", "Utilities", "Forced draft fan of cooling tower", "ZEN_CT_FAN_01"),
    ("Boiler Feed Pump A", "Boiler Island", "Feeds water to the boiler", ""),
    ("Boiler Feed Pump B", "Boiler Island", "Feeds water to the boiler", ""),
    ("Air Cooled Heat Exchanger", "Process Area", "Cools process fluid with air", ""),
    ("Shell And Tube Heat Exchanger", "Process Area", "Feed preheater", ""),
    ("Condensate Extraction Pump", "Turbine Hall", "Extracts condensate from condenser", ""),
    ("Induced Draft Fan", "Boiler Island", "Balances furnace draft", ""),
    ("Forced Draft Fan", "Boiler Island", "Supplies combustion air", ""),
    ("Steam Turbine Generator", "Turbine Hall", "Main power generation unit", ""),
    ("Deaerator", "Boiler Island", "Removes dissolved oxygen from feedwater", ""),
    ("Soot Blower", "Boiler Island", "Cleans boiler heating surfaces", ""),
    ("Electrostatic Precipitator", "Flue Gas Path", "Removes ash from flue gas", ""),
    ("Fire Water Pump", "Safety Systems", "Diesel engine driven fire pump", ""),
    ("Sprinkler Valve Bank", "Safety Systems", "Deluge protection for transformer", ""),
    ("Air Compressor", "Utilities", "Instrument air supply", ""),
    ("Instrument Air Receiver Tank", "Utilities", "Buffers instrument air", ""),
    ("Chilled Water Circulation Pump", "HVAC", "Chilled water loop of control room", ""),
    ("Water Treatment Plant RO Skid", "Water Wing", "Reverse osmosis unit", ""),
    ("Cooling Water Circulation Pump", "Utilities", "Circulates cooling water", ""),
    ("Motor Control Centre Panel", "Electrical", "Feeds utility motors", ""),
    ("Uninterruptible Power Supply", "Electrical", "Backup for control room", ""),
    ("Diesel Generator Set", "Electrical", "Emergency standby power", ""),
    ("Main Power Transformer", "Switchyard", "Steps up generator voltage", ""),
    ("Circuit Breaker Panel", "Switchyard", "Protects outgoing feeders", ""),
    ("Safety Valve on Steam Drum", "Boiler Island", "Overpressure protection", ""),
    ("Control Valve for Feed Water Line", "Boiler Island", "Modulates feedwater flow", ""),
    ("Temperature Transmitter", "Process Area", "Measures reactor outlet temperature", ""),
    ("Pressure Transmitter", "Process Area", "Measures header pressure", ""),
    ("Flow Transmitter", "Process Area", "Measures feedwater flow", ""),
    ("Level Transmitter on Expansion Tank", "Utilities", "Monitors tank level", ""),
    ("Ventilation Duct Fan", "HVAC", "Battery room ventilation", ""),   # 'duct'/'ventilation' unmatched on purpose
    ("Ash Slurry Pump", "Ash Handling", "Evacuates bottom ash", ""),
    ("Coal Handling Conveyor", "Material Handling", "Feeds coal to bunkers", ""),
    ("Bag Filter", "Flue Gas Path", "Secondary dust filtration", ""),
    ("Hydrogen Cooling Skid", "Turbine Hall", "Generator hydrogen system", ""),
]

ABBREVIATION_ROWS = [
    # (Full Term, Abbreviation) — multi-word phrases included on purpose
    ("Air Cooled Heat Exchanger", "ACHE"),
    ("Air Compressor", "AC"),
    ("Ash", "ASH"),
    ("Bag Filter", "BF"),
    ("Boiler", "BLR"),
    ("Boiler Feed Pump", "BFP"),
    ("Breaker", "BKR"),
    ("Chilled Water", "CHW"),
    ("Circuit Breaker", "CB"),
    ("Coal Handling", "CH"),
    ("Condensate Extraction Pump", "CEP"),
    ("Control Room", "CR"),
    ("Control Valve", "CV"),
    ("Conveyor", "CVR"),
    ("Cooling Tower", "CT"),
    ("Cooling Water", "CW"),
    ("Circulation", "CIRC"),
    ("Deaerator", "DA"),
    ("Diesel Generator", "DG"),
    ("Electrical", "ELEC"),
    ("Electrostatic Precipitator", "ESP"),
    ("Expansion Tank", "ET"),
    ("Fan", "FAN"),
    ("Feed Water", "FW"),
    ("Filter", "FLT"),
    ("Fire Water", "FWTR"),
    ("Flow", "F"),
    ("Forced Draft Fan", "FDF"),
    ("Generator", "GEN"),
    ("Heat Exchanger", "HX"),
    ("Hydrogen", "H2"),
    ("Induced Draft Fan", "IDF"),
    ("Instrument Air", "IA"),
    ("Level", "L"),
    ("Main", "MN"),
    ("Motor", "M"),
    ("Motor Control Centre", "MCC"),
    ("Panel", "PNL"),
    ("Power", "PWR"),
    ("Pressure", "P"),
    ("Pump", "P"),
    ("Receiver Tank", "RT"),
    ("Reverse Osmosis", "RO"),
    ("Safety Valve", "SV"),
    ("Set", "ST"),
    ("Shell And Tube Heat Exchanger", "STHE"),
    ("Skid", "SKID"),
    ("Slurry", "SLRY"),
    ("Soot Blower", "SB"),
    ("Sprinkler", "SPR"),
    ("Steam", "STM"),
    ("Steam Drum", "SD"),
    ("Steam Turbine", "STB"),
    ("Supply", "SPLY"),
    ("Switchyard", "SWYD"),
    ("Temperature", "T"),
    ("Transmitter", "TT"),
    ("Treatment", "TRT"),
    ("Turbine", "TB"),
    ("Uninterruptible Power Supply", "UPS"),
    ("Valve", "V"),
    ("Water", "W"),
    ("Water Treatment Plant", "WTP"),
    ("Cooling Water Circulation Pump", "CWCP"),
]


def main() -> None:
    SAMPLE_DIR.mkdir(parents=True, exist_ok=True)

    equipment = pd.DataFrame(
        EQUIPMENT_ROWS,
        columns=["Equipment Name", "Plant Section", "Service / Description", "Existing Tag"],
    )
    abbreviations = pd.DataFrame(ABBREVIATION_ROWS, columns=["Full Term", "Abbreviation"])

    equipment.to_excel(SAMPLE_DIR / "equipment_list_sample.xlsx", index=False)
    equipment.to_csv(SAMPLE_DIR / "equipment_list_sample.csv", index=False)
    abbreviations.to_excel(SAMPLE_DIR / "abbreviations_sample.xlsx", index=False)
    abbreviations.to_csv(SAMPLE_DIR / "abbreviations_sample.csv", index=False)

    print(f"Sample files written to {SAMPLE_DIR}")
    print(f"  equipment_list_sample.xlsx/.csv  ({len(equipment)} rows)")
    print(f"  abbreviations_sample.xlsx/.csv   ({len(abbreviations)} rows)")


if __name__ == "__main__":
    main()
