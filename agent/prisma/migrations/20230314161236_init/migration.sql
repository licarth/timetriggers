/*
  Warnings:

  - You are about to drop the column `scheduledAt` on the `JobDocument` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_JobDocument" (
    "jobId" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "statusId" TEXT NOT NULL,
    CONSTRAINT "JobDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("projectId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobDocument_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobStatus" ("jobId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_JobDocument" ("jobId", "projectId", "statusId") SELECT "jobId", "projectId", "statusId" FROM "JobDocument";
DROP TABLE "JobDocument";
ALTER TABLE "new_JobDocument" RENAME TO "JobDocument";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
