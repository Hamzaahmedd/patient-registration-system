import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.patient.count();
  if (existing > 0) {
    console.log(`Seed skipped - ${existing} patient(s) already present.`);
    return;
  }

  const jane = await prisma.patient.create({
    data: {
      first_name: "Jane",
      last_name: "Doe",
      date_of_birth: new Date(Date.UTC(1990, 0, 5)),
      sex: "FEMALE",
      phone_number: "5551234567",
      email: "jane.doe@example.com",
      address_line_1: "12 Main Street",
      city: "Springfield",
      state: "IL",
      zip_code: "62704",
      preferred_language: "English",
    },
  });

  await prisma.patient.create({
    data: {
      first_name: "Miguel",
      last_name: "Alvarez",
      date_of_birth: new Date(Date.UTC(1985, 6, 20)),
      sex: "MALE",
      phone_number: "5559876543",
      address_line_1: "400 Oak Avenue",
      address_line_2: "Apt 3B",
      city: "Austin",
      state: "TX",
      zip_code: "73301",
      insurance_provider: "Blue Cross",
      insurance_member_id: "BC123456",
      preferred_language: "Spanish",
    },
  });

  console.log("Seeded 2 demo patients.");

  await prisma.transcript.createMany({
    data: [
      {
        patient_id: jane.patient_id,
        vapi_call_id: "seed-call-jane-001",
        summary: "Jane Doe called to register as a new patient and completed intake successfully.",
        transcript_text:
          "AI: Thanks for calling - this is Alex, your patient intake coordinator. Can I get your first and last name to get started?\n" +
          "User: Hi, my name is Jane Doe.\n" +
          "AI: Thanks, Jane. Let me confirm your details before we finish up... You're all set, Jane. Thanks for calling, and take care!",
        recording_url: "https://storage.example.com/recordings/seed-call-jane-001.mp3",
        duration_seconds: 96,
      },
      {
        patient_id: null,
        vapi_call_id: "seed-call-anonymous-001",
        summary: "Caller hung up before providing enough information to identify or register them.",
        transcript_text:
          "AI: Thanks for calling - this is Alex, your patient intake coordinator. Can I get your first and last name to get started?\n" +
          "User: Uh, actually never mind, wrong number.\n" +
          "AI: No problem at all - have a great day!",
        recording_url: "https://storage.example.com/recordings/seed-call-anonymous-001.mp3",
        duration_seconds: 14,
      },
    ],
  });

  console.log("Seeded 2 demo transcripts (1 linked to Jane Doe, 1 anonymous).");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
