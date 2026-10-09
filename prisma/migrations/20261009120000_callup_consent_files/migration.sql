-- AlterTable
ALTER TABLE "callups" ADD COLUMN "documentsSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "callup_consent_files" (
    "id" TEXT NOT NULL,
    "callupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "callup_consent_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "callup_consent_files_callupId_key" ON "callup_consent_files"("callupId");

-- AddForeignKey
ALTER TABLE "callup_consent_files" ADD CONSTRAINT "callup_consent_files_callupId_fkey" FOREIGN KEY ("callupId") REFERENCES "callups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
