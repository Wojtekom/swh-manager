-- CreateEnum
CREATE TYPE "VolunteerAgreementStatus" AS ENUM ('SENT', 'PARENT_SIGNED', 'ACTIVE', 'ENDED', 'CANCELLED');

-- CreateTable
CREATE TABLE "volunteer_agreements" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "maxHours" INTEGER,
    "status" "VolunteerAgreementStatus" NOT NULL DEFAULT 'SENT',
    "school" TEXT,
    "childSignature" TEXT,
    "childAcceptedAt" TIMESTAMP(3),
    "parentId" TEXT,
    "parentSignature" TEXT,
    "parentAcceptedAt" TIMESTAMP(3),
    "parentIp" TEXT,
    "boardApprovedAt" TIMESTAMP(3),
    "boardApprovedBy" TEXT,
    "certificateIssuedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "volunteer_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_hours" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "eventType" TEXT NOT NULL,
    "tasks" TEXT NOT NULL,
    "timeFrom" TEXT,
    "timeTo" TEXT,
    "hours" DOUBLE PRECISION NOT NULL,
    "coachName" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "volunteer_hours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "volunteer_agreements_number_key" ON "volunteer_agreements"("number");

-- CreateIndex
CREATE INDEX "volunteer_agreements_playerId_idx" ON "volunteer_agreements"("playerId");

-- CreateIndex
CREATE INDEX "volunteer_hours_agreementId_idx" ON "volunteer_hours"("agreementId");

-- AddForeignKey
ALTER TABLE "volunteer_agreements" ADD CONSTRAINT "volunteer_agreements_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_hours" ADD CONSTRAINT "volunteer_hours_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "volunteer_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

