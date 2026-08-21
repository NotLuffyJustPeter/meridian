-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "placeId" TEXT;

-- CreateIndex
CREATE INDEX "activities_placeId_idx" ON "activities"("placeId");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE;
