-- CreateTable
CREATE TABLE "JobStatus" (
    "jobId" TEXT NOT NULL PRIMARY KEY,
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
    "scheduledAt" DATETIME NOT NULL,
    "projectId" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    CONSTRAINT "JobDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("projectId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobDocument_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobStatus" ("jobId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "projectId" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT
);
