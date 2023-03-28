-- CreateTable
CREATE TABLE "JobStatus" (
    "jobId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "registeredAt" DATETIME NOT NULL,
    "rateLimitedAt" DATETIME,
    "queuedAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "JobDocument" (
    "jobId" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "statusId" TEXT NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "jobDefinition" BLOB NOT NULL,
    CONSTRAINT "JobDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("projectId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobDocument_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "JobStatus" ("jobId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "projectId" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "JobStatus_jobId_key" ON "JobStatus"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "JobDocument_statusId_key" ON "JobDocument"("statusId");
