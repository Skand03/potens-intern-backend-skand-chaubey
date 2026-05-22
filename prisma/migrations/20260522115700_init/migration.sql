-- CreateTable
CREATE TABLE "logs" (
    "id" SERIAL NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "event_time" TEXT NOT NULL,
    "previous_hash" TEXT NOT NULL,
    "current_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "logs_current_hash_key" ON "logs"("current_hash");

-- CreateIndex
CREATE INDEX "logs_event_time_idx" ON "logs"("event_time");

-- CreateIndex
CREATE INDEX "logs_actor_idx" ON "logs"("actor");
