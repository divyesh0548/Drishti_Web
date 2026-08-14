-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SITE_ADMIN', 'COMPANY_ADMIN', 'FINANCE', 'AUDITOR');

-- CreateEnum
CREATE TYPE "VersionStatus" AS ENUM ('DRAFT', 'ISSUED');

-- CreateTable
CREATE TABLE "companies" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "defaultVersionId" TEXT,
    "reportingCurrency" TEXT NOT NULL DEFAULT 'INR',
    "unitsLabel" TEXT NOT NULL DEFAULT '(Rs. in lakhs)',
    "excelProfileId" TEXT,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "companyId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "temp_login" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statement_versions" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "status" "VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trialBalanceFileName" TEXT,
    "trialBalanceFileKey" TEXT,

    CONSTRAINT "statement_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trial_balance_ledgers" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "financialStatementItem" TEXT NOT NULL DEFAULT '',
    "glNumber" TEXT NOT NULL,
    "glDescription" TEXT NOT NULL DEFAULT '',
    "currentYear" DECIMAL(18,2) NOT NULL,
    "previousYear" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "trial_balance_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_grouping_overrides" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "glNumber" TEXT NOT NULL,
    "glDescription" TEXT NOT NULL DEFAULT '',
    "groupKey" TEXT NOT NULL,
    "subgroupKey" TEXT NOT NULL,
    "accountClass" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "subgroupLabel" TEXT NOT NULL,
    "noteNumber" TEXT NOT NULL,
    "noteTitle" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_grouping_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_groupings" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "groupKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "keywords" TEXT[],
    "noteNumber" TEXT,
    "subgroupKey" TEXT,

    CONSTRAINT "master_groupings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_companyId_idx" ON "users"("companyId");

-- CreateIndex
CREATE INDEX "statement_versions_companyId_financialYear_idx" ON "statement_versions"("companyId", "financialYear");

-- CreateIndex
CREATE UNIQUE INDEX "statement_versions_companyId_versionNumber_key" ON "statement_versions"("companyId", "versionNumber");

-- CreateIndex
CREATE INDEX "trial_balance_ledgers_versionId_glNumber_idx" ON "trial_balance_ledgers"("versionId", "glNumber");

-- CreateIndex
CREATE UNIQUE INDEX "trial_balance_ledgers_versionId_lineNo_key" ON "trial_balance_ledgers"("versionId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_grouping_overrides_versionId_glNumber_key" ON "ledger_grouping_overrides"("versionId", "glNumber");

-- CreateIndex
CREATE INDEX "master_groupings_companyId_groupKey_idx" ON "master_groupings"("companyId", "groupKey");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statement_versions" ADD CONSTRAINT "statement_versions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statement_versions" ADD CONSTRAINT "statement_versions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_balance_ledgers" ADD CONSTRAINT "trial_balance_ledgers_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "statement_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_grouping_overrides" ADD CONSTRAINT "ledger_grouping_overrides_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "statement_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_groupings" ADD CONSTRAINT "master_groupings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
