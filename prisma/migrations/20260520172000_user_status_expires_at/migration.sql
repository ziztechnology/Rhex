ALTER TABLE "User" ADD COLUMN "statusExpiresAt" TIMESTAMPTZ(3);

CREATE INDEX "User_status_statusExpiresAt_idx" ON "User"("status", "statusExpiresAt");
