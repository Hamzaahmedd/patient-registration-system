-- CreateTable
CREATE TABLE "transcripts" (
    "id" UUID NOT NULL,
    "patient_id" UUID,
    "vapi_call_id" VARCHAR(100) NOT NULL,
    "summary" TEXT,
    "transcript_text" TEXT,
    "recording_url" VARCHAR(500),
    "duration_seconds" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transcripts_vapi_call_id_key" ON "transcripts"("vapi_call_id");

-- CreateIndex
CREATE INDEX "transcripts_patient_id_idx" ON "transcripts"("patient_id");

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("patient_id") ON DELETE SET NULL ON UPDATE CASCADE;
