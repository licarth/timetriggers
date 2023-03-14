-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_JobDocument" (
    "jobId" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "statusId" TEXT NOT NULL,
    CONSTRAINT "JobDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("projectId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobDocument_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "JobStatus" ("jobId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_JobDocument" ("jobId", "projectId", "statusId") SELECT "jobId", "projectId", "statusId" FROM "JobDocument";
DROP TABLE "JobDocument";
ALTER TABLE "new_JobDocument" RENAME TO "JobDocument";
CREATE UNIQUE INDEX "JobDocument_statusId_key" ON "JobDocument"("statusId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
