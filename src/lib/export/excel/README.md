# Excel export profiles

Excel statement downloads use a **pluggable profile** per company.
PDF export does **not** use this system — it stays on the shared common renderer.

## Resolution order (default = company id)

1. Optional `company.settings.excelProfileId` (advanced override — not required)
2. Profile whose `companyIds` includes the company ← **default way**
3. Fallback: `v8-linked` (shared V-8 linked workbook)

## Active custom profiles

| Profile id | Company ids | Template |
|------------|-------------|----------|
| `xyz-desired-structure` | `xyz` | `templates/excel/xyz-desired-structure.xlsx` |
| `ltel-desired-structure` | `ltel` | `templates/excel/ltel-desired-structure.xlsx` |

### Template-copy fill (XYZ + LTEL)

These profiles **copy the base workbook** and only:

1. Substitute **dates / years** (and company name) inside existing text cells
2. Write **calculated StatementPack amounts** into mapped numeric cells

All other wording, layout, and merges stay from the base file.
Header/total **background colors** are still applied for every company
(`colorsOnly` for template profiles — no column autofit/clamp).

Shared helpers live in `template-fill.ts`. Pack maps:

- `profiles/xyz-pack-map.ts`
- `profiles/ltel-pack-map.ts`

XYZ still drops non-statement tabs (Master Grouping, working / IT / Draft). LTEL keeps
every tab from its desired-structure file.

### Global table colors & column width

`report-table-styles.ts` runs for **every** Excel export:

- Header rows: dark blue background + white bold text
- Total rows: light blue background + bold text
- Column auto-width (V-8 only) capped at **2 standard cells**; longer text wraps

## Files

| Path | Role |
|------|------|
| `types.ts` | Profile + context contracts |
| `registry.ts` | Resolve profile for a company |
| `index.ts` | `buildStatementWorkbook` entry |
| `template-fill.ts` | Date/year text substitution + calc-on-load |
| `profiles/v8-linked.ts` | Default fallback builder |
| `profiles/xyz.ts` | XYZ template-copy builder |
| `profiles/xyz-pack-map.ts` | Pack → XYZ cell map |
| `profiles/ltel.ts` | LTEL template-copy builder |
| `profiles/ltel-pack-map.ts` | Pack → LTEL cell map |
| `profiles/custom.ts` | Register company-specific profiles |
