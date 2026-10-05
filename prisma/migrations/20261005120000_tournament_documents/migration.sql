-- AlterTable
ALTER TABLE "callups" ADD COLUMN "consentReceivedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "tournament_documents" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tournament_documents_tournamentId_idx" ON "tournament_documents"("tournamentId");

-- AddForeignKey
ALTER TABLE "tournament_documents" ADD CONSTRAINT "tournament_documents_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
