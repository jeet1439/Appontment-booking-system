import { PrismaClient, Role } from "@prisma/client";
import { faker } from "@faker-js/faker";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const specializations = [
  "Cardiologist",
  "Dermatologist",
  "Neurologist",
  "Orthopedic",
  "Pediatrician",
  "Psychiatrist",
  "Dentist",
  "General Physician",
  "Gynecologist",
  "ENT Specialist",
];

async function main() {
  console.log("Starting database seed...");
  const hashedPassword = await bcrypt.hash("password123", 10);

  // Delete existing data
  await prisma.appointment.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany();

  console.log("Existing data deleted.");

  // =========================
  // CREATE 1000 DOCTORS
  // =========================

  console.log("Creating doctors...");

  for (let i = 1; i <= 1000; i++) {
    await prisma.user.create({
      data: {
        email: `doctor${i}@example.com`,

        // Store hashed password
        password: hashedPassword,

        role: Role.DOCTOR,

        doctor: {
          create: {
            name: faker.person.fullName(),

            specialization: faker.helpers.arrayElement(
              specializations
            ),

            phone: faker.phone.number(),

            experience: faker.number.int({
              min: 1,
              max: 30,
            }),

            bio: faker.lorem.sentence({
              min: 10,
              max: 20,
            }),
          },
        },
      },
    });

    if (i % 100 === 0) {
      console.log(`${i}/1000 doctors created`);
    }
  }

  // =========================
  // CREATE 1000 PATIENTS
  // =========================

  console.log("Creating patients...");

  for (let i = 1; i <= 1000; i++) {
    await prisma.user.create({
      data: {
        email: `patient${i}@example.com`,
        password: hashedPassword,

        role: Role.PATIENT,

        patient: {
          create: {
            name: faker.person.fullName(),

            phone: faker.phone.number(),

            dateOfBirth: faker.date.birthdate({
              min: 18,
              max: 80,
              mode: "age",
            }),
          },
        },
      },
    });

    if (i % 100 === 0) {
      console.log(`${i}/1000 patients created`);
    }
  }

  console.log("Database seeding completed successfully!");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });