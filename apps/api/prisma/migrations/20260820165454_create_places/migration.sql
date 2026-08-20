-- CreateEnum
CREATE TYPE "PlaceCategory" AS ENUM ('LANDMARK', 'FOOD', 'LODGING', 'SHOPPING', 'TRANSPORT', 'ENTERTAINMENT', 'NATURE', 'OTHER');

-- CreateTable
CREATE TABLE "places" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "PlaceCategory" NOT NULL DEFAULT 'OTHER',
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "notes" TEXT,
    "website" TEXT,
    "sourceProvider" TEXT,
    "sourcePlaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "places_tripId_idx" ON "places"("tripId");

-- CreateIndex
CREATE INDEX "places_tripId_category_idx" ON "places"("tripId", "category");

-- CreateIndex
CREATE INDEX "places_tripId_name_idx" ON "places"("tripId", "name");

-- CreateIndex
CREATE INDEX "places_tripId_sourceProvider_sourcePlaceId_idx" ON "places"("tripId", "sourceProvider", "sourcePlaceId");

-- AddForeignKey
ALTER TABLE "places" ADD CONSTRAINT "places_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
