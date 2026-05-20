ALTER TABLE "Comment" ADD COLUMN "privateRecipientUserId" INTEGER;

ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_privateRecipientUserId_fkey"
  FOREIGN KEY ("privateRecipientUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Comment_privateRecipientUserId_idx" ON "Comment"("privateRecipientUserId");
