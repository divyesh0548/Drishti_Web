# Company Excel structure handoff template

Use this when asking the agent to implement a **new company-specific Excel profile**.
PDF stays common — only describe Excel.

---

## 1. Company identity

- Company name: xyz
- Company id in portal (from `data/companies/...` or admin UI): xyz
- Preferred profile id (e.g. `acme-fy26`):
- Financial year(s) this layout applies to: All

## 2. Workbook overview

- Desired download filename pattern: {company_name}_{FY}_Financial Statements
- Sheet tab order (exact names, top to bottom):
4. Master Grouping
5. TB BVS 31.3.25
6. TB BVS 31.03.26
7. BS
8. PL
9. CFS Working
10. IT Computation_FY24
11. IT Comp workings_FY24
12. Cash Flow_FY26
13. SOCIE
14. PPE- note 3
15. Draft-TC
16. DT-FY26
17. WA-Shares
18. BS  Notes  4-19
19. PL Notes 20-27
20. Note 28-31
21. Segment
22. FI -32
23. Ratios -33
24. Note - 34-35
25. Note -36
26. Note - 40
27. DT
28. WA Share Working
29. IT Com
30. DT_V1-Final
31. IT Dep
32. CA Dep
33. SAP TB_FY24
34. Client TB 23
35. Ind AS 101 - Note 22 & 23
36. Workings >>>
37. TB BVS 31.3.23
38. GL Summary
39. TB BVS 31.3.22
40. OCPS - BVS

## 3. Per-sheet specification

Copy this block once per sheet:

### Sheet: `<exact tab name>`

- Purpose:
- Columns (letter → meaning), e.g. `A=Particulars, B=Note, C=Current FY, D=Previous FY`
- Header / title rows (what text, which cells):
- Row-by-row or section outline:
  - Section name
  - Line items (and which StatementPack note / TB grouping they come from)
  - Totals / subtotals (formula vs hardcoded)
- Formulas that must exist (cross-sheet refs OK):
- Styling notes (optional): bold totals, number format, units label
- Signatories / footer block (if any)

## 4. Mapping to portal data

For each amount line, say how it maps:

| Sheet | Cell/row | Source | Notes |
|-------|----------|--------|-------|
| BS | Share Capital current | pack note `3` total current | |
| PL | Revenue | pack note `19` / display note `20` | |

Preferred sources (in order):

1. `StatementPack` notes / BS / PL rows (`context.pack`)
2. Trial balance snapshot ledgers (`context.snapshot.rows`)
3. Company settings (directors, auditors, footer)

## 5. Attachments (strongly preferred)

Attach one or more of:

1. **Sample filled `.xlsx`** for that company (best)
2. **Blank template `.xlsx`** with sheet names + headers
3. Screenshots of each sheet if Excel cannot be shared
4. Existing auditor/client workbook to match

## 6. Differences vs current V-8 fallback

List only what must change, e.g.:

- Extra sheets: …
- Different note numbering: …
- Different BS line order: …
- No formula links to Trial Balance: …
- Units in rupees vs lakhs: …

## 7. Out of scope

Confirm:

- [ ] PDF must remain the common shared layout
- [ ] Companies without this profile keep V-8 Excel fallback
- [ ] Classification/mapping stays in Mapping Studio (not re-defined in Excel builder)
