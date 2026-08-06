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

### XYZ Option B data fill

`profiles/xyz-pack-map.ts` maps `StatementPack` note totals into XYZ template cells:

- BS / PL face amounts (whole numbers, no decimals)
- `BS  Notes  4-19` / `PL Notes 20-27` total cells
- `PPE- note 3` carrying value + depreciation
- Cash Flow net section totals

XYZ exports keep: `Input`, TB BVS dependency sheets, `BS`, `PL`, `Cash Flow_FY26`,
`SOCIE`, `PPE- note 3`, `BS  Notes  4-19`, `PL Notes 20-27`, and subsequent note
tabs (`Note 28-31`, `FI -32`, `Ratios -33`, `Note - 34-35`, `Note -36`,
`Note - 40`). `Segment`, Master Grouping, and working / IT / Draft tabs are dropped.

### LTEL Option B data fill

`profiles/ltel-pack-map.ts` maps pack note totals into LTEL BS / PL / note / CashFlow
cells (portal note numbers → LTEL face notes). All tabs from
`ltel-desired-structure.xlsx` are kept (`BS`, `PL`, `SOCE`, `CashFlow`, notes `2`–`27`,
`Note 28 to 43`).

### Global table colors & column width (all companies)

`report-table-styles.ts` is applied in `buildStatementWorkbookExport` for **every**
Excel export:

- Header rows: dark blue background + white bold text
- Total rows: light blue background + bold text
- Column auto-width capped at **2 standard cells**; longer text wraps

## Files

| Path | Role |
|------|------|
| `types.ts` | Profile + context contracts |
| `registry.ts` | Resolve profile for a company |
| `index.ts` | `buildStatementWorkbook` entry |
| `profiles/v8-linked.ts` | Default fallback builder |
| `profiles/xyz.ts` | XYZ desired structure builder |
| `profiles/xyz-pack-map.ts` | Pack → XYZ cell map (Option B) |
| `profiles/ltel.ts` | LTEL desired structure builder |
| `profiles/ltel-pack-map.ts` | Pack → LTEL cell map (Option B) |
| `profiles/custom.ts` | Register company-specific profiles |
