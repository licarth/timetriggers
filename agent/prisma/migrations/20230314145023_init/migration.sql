/*
  Warnings:

  - The primary key for the `JobStatus` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_JobStatus" (
    "jobId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "registeredAt" DATETIME NOT NULL,
    "rateLimitedAt" DATETIME,
    "queuedAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME
);
INSERT INTO "new_JobStatus" ("completedAt", "jobId", "queuedAt", "rateLimitedAt", "registeredAt", "startedAt", "value") SELECT "completedAt", "jobId", "queuedAt", "rateLimitedAt", "registeredAt", "startedAt", "value" FROM "JobStatus";
DROP TABLE "JobStatus";
ALTER TABLE "new_JobStatus" RENAME TO "JobStatus";
CREATE UNIQUE INDEX "JobStatus_jobId_key" ON "JobStatus"("jobId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
