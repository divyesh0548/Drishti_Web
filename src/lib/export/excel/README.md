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

- BS / PL face amounts
- `BS  Notes  4-19` / `PL Notes 20-27` total cells those formulas used
- `PPE- note 3` carrying value + depreciation
- Cash Flow net section totals

TB debit/credit still come from the company trial balance. Sheets without a pack source (Ratios, DT workings, IT, Segment, etc.) remain template structure until mapped.

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
