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

### XYZ Option B data fill

`profiles/xyz-pack-map.ts` maps `StatementPack` note totals into XYZ template cells:

- BS / PL face amounts (whole numbers, no decimals)
- `BS  Notes  4-19` / `PL Notes 20-27` total cells
- `PPE- note 3` carrying value + depreciation
- Cash Flow net section totals

XYZ exports keep: `Input`, TB BVS dependency sheets, `BS`, `PL`, `Cash Flow_FY26`,
`SOCIE`, `PPE- note 3`, `BS  Notes  4-19`, `PL Notes 20-27`, and subsequent note
tabs (`Note 28-31`, `Segment`, `FI -32`, `Ratios -33`, `Note - 34-35`, `Note -36`,
`Note - 40`). Master Grouping and working / IT / Draft tabs are dropped.

### Global table colors (all companies)

`report-table-styles.ts` defines `REPORT_TABLE_COLOR_CONFIG` and is applied in
`buildStatementWorkbookExport` for **every** Excel export (XYZ + V-8 fallback):

- Header rows: dark blue background + white bold text
- Total rows: light blue background + bold text



## Files

| Path | Role |
|------|------|
| `types.ts` | Profile + context contracts |
| `registry.ts` | Resolve profile for a company |
| `index.ts` | `buildStatementWorkbook` entry |
| `profiles/v8-linked.ts` | Default fallback builder |
| `profiles/xyz.ts` | XYZ desired structure builder |
| `profiles/xyz-pack-map.ts` | Pack → XYZ cell map (Option B) |
| `profiles/custom.ts` | Register company-specific profiles |
