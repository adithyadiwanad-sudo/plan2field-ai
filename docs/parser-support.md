# Parser support

All uploads are limited to 20 MiB. Schedule adapters target at most 10,000 activities. Failed imports remain inactive; preview contains errors/warnings and original mapped values. Approved baseline mapping requires an explicit checkbox. WBS depth filtering is configurable. No dependency is inferred from an activity name.

| Input | Supported | Explicit limitations |
|---|---|---|
| Canonical UTF-8 CSV | Required IDs, description, WBS path, operation, quantity, unit, measurement method; optional baseline/forecast dates, discipline, area, full tags/lines, components, weights and relationships | See exact headers in fixture; approved measurement definitions required |
| Primavera XER subset | UTF-8 `%T/%F/%R` TASK and TASKPRED; task_code/task_name identity mapping; task_id predecessor resolution; typed relationships and lag hours retained | Requires canonical measurement/WBS/context columns already mapped into TASK rows; ordinary exports without these fields reject with errors. Resource assignments/calendars and many vendor fields are not interpreted. Current dates are not automatically approved baselines |
| MS Project XML subset | Namespace-independent Tasks/Task, numeric UID, Name, WBS, Summary filtering; named ExtendedAttribute canonical mapping fields; PredecessorLink Type/UID/LinkLag retained | This is a mapped subset, not general MPP/XML compatibility. Numeric FieldID mapping, resource calendars, custom-field lookup tables and scheduling engines are not implemented. Lag remains tenths of minutes as supplied |
| Report CSV/XLSX | Explicit text-column mapping; sheet and row metadata retained; 5,000-row limit; read-only workbook parser | UI maps the `report_text` header; API accepts other explicit text-column names. Formula cells are rejected, macros are not executed; workbook expansion <=30 MB and <=500 archive entries |
| Voice | Browser MediaRecorder; actual audio stream/duration checked with ffprobe; FFmpeg mono 16 kHz conversion; local Whisper base, English | 1–120 seconds, 20 MiB; no offline browser inference. Missing Whisper or FFmpeg produces a visible failure. No voice accuracy measurement in this environment |
| Scan | Local Tesseract, English printed PNG/JPEG, page 1 evidence, <=20 megapixels, 60-second OCR timeout | PDF/multipage conversion and reliable handwriting recognition are disabled. Extracted fields require review |

## Canonical columns

Required: `external_activity_id, description, wbs_path, activity_type, planned_total_quantity, quantity_unit, measurement_method`.

Optional: `discipline, area, line_number, asset_tag, baseline_start, baseline_finish, forecast_start, forecast_finish, components, weights, relationships`.

Operations use explicit `ERECTION`, `FABRICATION`, `WELDING`, `INSPECTION`, `TESTING`, `INSULATION` or `CIVIL` definitions. This mapping is domain metadata, not the scheduling source's task-type enum.

Dates are ISO `YYYY-MM-DD`. Quantity must be positive and finite. Methods: `QUANTITY`, `EQUAL_COMPONENTS`, `WEIGHTED_COMPONENTS`. Component IDs are pipe-separated, e.g. `S01|S02|S03`; weighted definitions have matching positive pipe-separated weights. Component count must equal planned quantity for the bounded demo measurement model.

`relationships` is a JSON array on the successor row:

```json
[{"predecessor":"ACT-24-FAB-01","type":"FS","lag":0,"lag_unit":"CALENDAR_DAYS"}]
```

Only same-version predecessor IDs are accepted; unknown and duplicate/self relationships reject the import. Relationships and their source units are stored, but not used to recalculate a schedule. No lossless round-trip to P6 or MS Project is claimed.

## Extraction vocabulary

`line twenty-four` → full line `24`; suffixes such as `24-A` remain distinct. Dates require explicit evidence. “Three out of ten” is cumulative, “three additional” incremental, named components use set semantics. Future statements and negation do not establish actuals. “Spool erected” alone is progress evidence, never whole-activity finish. Independent sentences are split; a following fraction qualifier or correction replacement set remains with its observation. General free-form multi-event language is outside the evaluated scope.
