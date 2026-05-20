CREATE TYPE "RssSourceApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "rss_source" ADD COLUMN "description" TEXT;

ALTER TABLE "rss_entry"
  ADD COLUMN "likeCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tipCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tipTotalPoints" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "rss_entry_like" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rss_entry_like_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rss_entry_tip" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "senderId" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  "giftId" TEXT,
  "giftNameSnapshot" TEXT,
  "giftIconSnapshot" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rss_entry_tip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rss_source_application" (
  "id" TEXT NOT NULL,
  "applicantId" INTEGER NOT NULL,
  "siteName" TEXT NOT NULL,
  "description" TEXT,
  "feedUrl" TEXT NOT NULL,
  "status" "RssSourceApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNote" TEXT,
  "reviewedById" INTEGER,
  "reviewedAt" TIMESTAMPTZ(3),
  "sourceId" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "rss_source_application_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rss_entry_like_entryId_userId_key" ON "rss_entry_like"("entryId", "userId");
CREATE INDEX "rss_entry_like_entryId_createdAt_idx" ON "rss_entry_like"("entryId", "createdAt");
CREATE INDEX "rss_entry_like_userId_createdAt_idx" ON "rss_entry_like"("userId", "createdAt");

CREATE INDEX "rss_entry_tip_entryId_createdAt_idx" ON "rss_entry_tip"("entryId", "createdAt");
CREATE INDEX "rss_entry_tip_senderId_createdAt_idx" ON "rss_entry_tip"("senderId", "createdAt");
CREATE INDEX "rss_entry_tip_entryId_senderId_createdAt_idx" ON "rss_entry_tip"("entryId", "senderId", "createdAt");

CREATE INDEX "rss_source_application_applicantId_status_createdAt_idx" ON "rss_source_application"("applicantId", "status", "createdAt");
CREATE INDEX "rss_source_application_status_createdAt_idx" ON "rss_source_application"("status", "createdAt");
CREATE INDEX "rss_source_application_reviewedById_reviewedAt_idx" ON "rss_source_application"("reviewedById", "reviewedAt");
CREATE INDEX "rss_source_application_sourceId_idx" ON "rss_source_application"("sourceId");

ALTER TABLE "rss_entry_like"
  ADD CONSTRAINT "rss_entry_like_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "rss_entry"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rss_entry_like"
  ADD CONSTRAINT "rss_entry_like_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rss_entry_tip"
  ADD CONSTRAINT "rss_entry_tip_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "rss_entry"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rss_entry_tip"
  ADD CONSTRAINT "rss_entry_tip_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rss_source_application"
  ADD CONSTRAINT "rss_source_application_applicantId_fkey"
  FOREIGN KEY ("applicantId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rss_source_application"
  ADD CONSTRAINT "rss_source_application_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "rss_source_application"
  ADD CONSTRAINT "rss_source_application_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "rss_source"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
