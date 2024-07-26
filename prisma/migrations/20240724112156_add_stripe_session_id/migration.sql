/*
  Warnings:

  - A unique constraint covering the columns `[stripeSessionId]` on the table `Sale` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Sale_stripeSessionId_key" ON "Sale"("stripeSessionId");
