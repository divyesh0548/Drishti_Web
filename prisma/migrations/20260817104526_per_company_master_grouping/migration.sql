/*
  Warnings:

  - A unique constraint covering the columns `[companyId,glNumber]` on the table `master_grouping_ledgers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,groupKey]` on the table `master_groupings` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `companyId` to the `master_grouping_ledgers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `master_groupings` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "master_grouping_ledgers" DROP CONSTRAINT "master_grouping_ledgers_groupKey_fkey";

-- DropIndex
DROP INDEX "master_grouping_ledgers_glNumber_key";

-- DropIndex
DROP INDEX "master_grouping_ledgers_groupKey_idx";

-- DropIndex
DROP INDEX "master_groupings_groupKey_key";

-- AlterTable
ALTER TABLE "master_grouping_ledgers" ADD COLUMN     "companyId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "master_groupings" ADD COLUMN     "companyId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "master_grouping_ledgers_companyId_groupKey_idx" ON "master_grouping_ledgers"("companyId", "groupKey");

-- CreateIndex
CREATE UNIQUE INDEX "master_grouping_ledgers_companyId_glNumber_key" ON "master_grouping_ledgers"("companyId", "glNumber");

-- CreateIndex
CREATE INDEX "master_groupings_companyId_idx" ON "master_groupings"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "master_groupings_companyId_groupKey_key" ON "master_groupings"("companyId", "groupKey");

-- AddForeignKey
ALTER TABLE "master_groupings" ADD CONSTRAINT "master_groupings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_grouping_ledgers" ADD CONSTRAINT "master_grouping_ledgers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_grouping_ledgers" ADD CONSTRAINT "master_grouping_ledgers_companyId_groupKey_fkey" FOREIGN KEY ("companyId", "groupKey") REFERENCES "master_groupings"("companyId", "groupKey") ON DELETE CASCADE ON UPDATE CASCADE;
