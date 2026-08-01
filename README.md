# FinGen AI

FinGen AI is a cloud-style financial statement automation portal scaffolded from the attached product brief. The current build reads `Trial Balance.xlsx` from the project root and derives draft financial statements directly from that workbook.

## What is included

- Finance-focused landing page and authenticated portal shell
- Dashboard, source data, import center, mapping studio, statements, workflow, reports, and admin modules
- Excel-backed trial balance ingestion and rule-based draft statement derivation
- React Query and theme providers wired into the app shell
- API routes for health, dashboard overview, and client data
- Docker, environment template, and Prisma schema starter

## Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS 4
- React Query
- React Hook Form + Zod
- Recharts

## Local setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Key routes

- `/` product overview
- `/dashboard` executive dashboard
- `/clients` workbook source preview
- `/import-center` trial balance ingestion workflow
- `/mapping-studio` ledger mapping and AI confidence
- `/statements` generated financial pack preview
- `/workflow` maker-checker-reviewer operations
- `/reports` exports and management commentary
- `/admin` roles, policies, and integrations

## Architecture notes

- `src/lib/types.ts` defines domain contracts
- `src/lib/trial-balance.ts` loads the workbook and derives statement data
- `src/components/layout` contains the portal shell
- `src/components/portal` contains reusable finance UI blocks
- `prisma/schema.prisma` sketches the first-pass relational model for a PostgreSQL backend

## Suggested next build steps

1. Add authentication with email OTP, Google, and Microsoft providers.
2. Replace heuristic bucket inference with a maintained chart-of-accounts mapping model.
3. Introduce background jobs for imports, document generation, and AI review.
4. Add OpenAI-backed mapping suggestions, notes generation, and commentary APIs.
5. Wire PDF, DOCX, and Excel export pipelines.
