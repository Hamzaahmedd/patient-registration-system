import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.patient.count();
  if (existing > 0) {
    console.log(`Seed skipped - ${existing} patient(s) already present.`);
    return;
  }

  await prisma.patient.createMany({
    data: [
      {
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
      {
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
    ],
  });

  console.log("Seeded 2 demo patients.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
