-- Master grouping is a global catalog (same for every company).
DROP TABLE IF EXISTS "master_groupings" CASCADE;

CREATE TABLE "master_groupings" (
    "id" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "statementArea" TEXT NOT NULL,
    "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "noteNumber" TEXT,
    "subgroupKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_groupings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "master_groupings_groupKey_key" ON "master_groupings"("groupKey");

CREATE TABLE "master_grouping_ledgers" (
    "id" TEXT NOT NULL,
    "glNumber" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,

    CONSTRAINT "master_grouping_ledgers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "master_grouping_ledgers_glNumber_key" ON "master_grouping_ledgers"("glNumber");
CREATE INDEX "master_grouping_ledgers_groupKey_idx" ON "master_grouping_ledgers"("groupKey");

ALTER TABLE "master_grouping_ledgers"
  ADD CONSTRAINT "master_grouping_ledgers_groupKey_fkey"
  FOREIGN KEY ("groupKey") REFERENCES "master_groupings"("groupKey")
  ON DELETE CASCADE ON UPDATE CASCADE;
