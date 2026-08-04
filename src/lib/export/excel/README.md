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

XYZ exports automatically use the desired workbook structure. No settings change needed.

## Files

| Path | Role |
|------|------|
| `types.ts` | Profile + context contracts |
| `registry.ts` | Resolve profile for a company |
| `index.ts` | `buildStatementWorkbook` entry |
| `profiles/v8-linked.ts` | Default fallback builder |
| `profiles/xyz.ts` | XYZ desired structure builder |
| `profiles/custom.ts` | Register company-specific profiles |

## Adding another company layout

1. Put the template under `templates/excel/`
2. Add a builder in `profiles/`
3. Register it in `profiles/custom.ts` with `companyIds: ["that-company-id"]`
