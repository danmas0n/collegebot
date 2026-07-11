# Extraction prompt and schema

This is the exact per-school prompt and JSON schema that produced the current
dataset (July 2026 run, Haiku extractors + Sonnet 10% audit). Reuse verbatim,
substituting `{TXT_PATH}`, `{YEAR}`, `{SCHOOL}`, `{OUT_PATH}`.

## Prompt

```
You are extracting structured data from a Common Data Set (CDS) filing.

Read the file {TXT_PATH} — plain text extracted from the {YEAR} CDS of
{SCHOOL}. It may be long; read all of it (in chunks if needed) before
answering. Layout may be messy (PDF text extraction); table columns can run
together, so match numbers to labels carefully.

Extract the fields of the provided schema. Rules:
- For all H2/H2A financial-aid fields, use the "Full-time First-time
  Freshmen" (first-year) column, NOT the "All undergraduates" column. CDS aid
  tables usually show 2-3 columns: first-time full-time freshmen; all
  full-time undergrads; less-than-full-time.
- Section map: B1 = enrollment; C1 = applied/admitted/enrolled counts (total
  of men+women); C8 = test policy (required/optional/blind); C9 = SAT/ACT
  25th/75th percentiles (prefer reported composite, else null); C10 = % in
  top tenth of HS class; C11/C12 = average HS GPA; G1 = cost of attendance;
  H2 = need-based aid; H2A = NON-need-based (merit) aid.
- THE MOST IMPORTANT FIELDS are in section H2A: (1) the number of students
  who "had no financial need and who were awarded institutional
  non-need-based scholarship or grant aid" -> merit.n_no_need_merit, and
  (2) the "average dollar amount of institutional non-need-based scholarship
  and grant aid awarded" to those students -> merit.avg_no_need_merit. Also
  the athletic equivalents -> merit.n_athletic, merit.avg_athletic. Take the
  first-year column. Double-check these four values before finishing.
- admissions.enrolled_ft_freshmen = full-time first-time degree-seeking
  freshmen enrolled (B1, men+women; or C1 enrolled total).
- need_aid: n_with_need = number of first-time freshmen "determined to have
  financial need"; pct_need_fully_met = % whose need was fully met;
  avg_pct_need_met = "average percent of need that was met";
  avg_need_based_award = average need-based scholarship/grant or aid package
  for freshmen.
- cost (G1): capture in-state and out-of-state tuition+required fees
  separately (for privates set both fields to the same value). food_housing =
  on-campus room & board. coa_total_* = total cost of attendance; use the
  document's total if given, otherwise sum components; null only if
  components are missing.
- Numbers: strip "$", ",", "%" — plain numbers. Percentages 0-100. GPA 0-4.x.
  Use null for genuinely absent values and explain in notes.
- confidence: high = all key fields found cleanly; medium = some ambiguity
  (note it); low = H2A missing or garbled.
- notes: one or two sentences on anything odd (missing sections, ambiguous
  columns, athletic aid lumped in, need-blind policies, etc.). Empty string
  if nothing.

After extracting, use the Write tool to save the exact same JSON object to:
{OUT_PATH}

Then return the object via structured output.
```

## Schema

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["school", "year", "confidence", "notes", "admissions", "cost", "need_aid", "merit"],
  "properties": {
    "school": {"type": "string"},
    "year": {"type": "string"},
    "confidence": {"enum": ["high", "medium", "low"]},
    "notes": {"type": "string"},
    "admissions": {
      "type": "object", "additionalProperties": false,
      "required": ["applied", "admitted", "enrolled_ft_freshmen", "sat_25", "sat_75", "act_25", "act_75", "avg_gpa", "pct_top_10", "test_policy"],
      "properties": {
        "applied": {"type": ["number", "null"]}, "admitted": {"type": ["number", "null"]},
        "enrolled_ft_freshmen": {"type": ["number", "null"]},
        "sat_25": {"type": ["number", "null"]}, "sat_75": {"type": ["number", "null"]},
        "act_25": {"type": ["number", "null"]}, "act_75": {"type": ["number", "null"]},
        "avg_gpa": {"type": ["number", "null"]}, "pct_top_10": {"type": ["number", "null"]},
        "test_policy": {"type": ["string", "null"]}
      }
    },
    "cost": {
      "type": "object", "additionalProperties": false,
      "required": ["tuition_fees_instate", "tuition_fees_outstate", "food_housing", "coa_total_instate", "coa_total_outstate"],
      "properties": {
        "tuition_fees_instate": {"type": ["number", "null"]}, "tuition_fees_outstate": {"type": ["number", "null"]},
        "food_housing": {"type": ["number", "null"]},
        "coa_total_instate": {"type": ["number", "null"]}, "coa_total_outstate": {"type": ["number", "null"]}
      }
    },
    "need_aid": {
      "type": "object", "additionalProperties": false,
      "required": ["n_with_need", "pct_need_fully_met", "avg_pct_need_met", "avg_need_based_award"],
      "properties": {
        "n_with_need": {"type": ["number", "null"]}, "pct_need_fully_met": {"type": ["number", "null"]},
        "avg_pct_need_met": {"type": ["number", "null"]}, "avg_need_based_award": {"type": ["number", "null"]}
      }
    },
    "merit": {
      "type": "object", "additionalProperties": false,
      "required": ["n_no_need_merit", "avg_no_need_merit", "n_athletic", "avg_athletic"],
      "properties": {
        "n_no_need_merit": {"type": ["number", "null"]}, "avg_no_need_merit": {"type": ["number", "null"]},
        "n_athletic": {"type": ["number", "null"]}, "avg_athletic": {"type": ["number", "null"]}
      }
    }
  }
}
```

## Audit prompt (Sonnet, ~10% sample)

```
You are auditing an automated data extraction from a Common Data Set filing.
Be skeptical and independent: locate each value yourself in the source before
comparing.

Source file: {TXT_PATH} (school: {SCHOOL}).
Extracted JSON to audit: {EXTRACTED_JSON}

Check ONLY these fields against the source, using the Full-time First-time
Freshmen column for aid fields:
1. merit.n_no_need_merit
2. merit.avg_no_need_merit
3. cost.coa_total_outstate
4. admissions.applied and admissions.admitted
5. need_aid.avg_pct_need_met

ok=true only if every checked value matches within rounding. For each
mismatch report {field, extracted, correct}.
```
