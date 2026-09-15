-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'DECLINE_TO_ANSWER');

-- CreateTable
CREATE TABLE "patients" (
    "patient_id" UUID NOT NULL,
    "first_name" VARCHAR(50) NOT NULL,
    "last_name" VARCHAR(50) NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "sex" "Sex" NOT NULL,
    "phone_number" VARCHAR(10) NOT NULL,
    "email" VARCHAR(254),
    "address_line_1" VARCHAR(200) NOT NULL,
    "address_line_2" VARCHAR(200),
    "city" VARCHAR(100) NOT NULL,
    "state" CHAR(2) NOT NULL,
    "zip_code" VARCHAR(10) NOT NULL,
    "insurance_provider" VARCHAR(150),
    "insurance_member_id" VARCHAR(50),
    "preferred_language" VARCHAR(50) NOT NULL DEFAULT 'English',
    "emergency_contact_name" VARCHAR(100),
    "emergency_contact_phone" VARCHAR(10),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "patients_pkey" PRIMARY KEY ("patient_id")
);

-- CreateIndex
CREATE INDEX "patients_last_name_idx" ON "patients"("last_name");

-- CreateIndex
CREATE INDEX "patients_phone_number_idx" ON "patients"("phone_number");

-- CreateIndex
CREATE INDEX "patients_date_of_birth_idx" ON "patients"("date_of_birth");
