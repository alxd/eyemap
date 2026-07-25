import "dotenv/config";
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

config({ path: ".env.local" });
config({ path: ".env" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(DATABASE_URL, { prepare: false, max: 1 });
const db = drizzle(client, { schema });

const SEED_PASSWORD = process.env.SEED_PASSWORD || "changeme123";

const clinicsSeed = [
  {
    name: "Retina Clinic Bucharest",
    city: "Bucharest",
    doctors: [
      { email: "doctor@retinaclinic.ro", name: "Dr. Demo Retina", role: "doctor" as const },
      { email: "admin@retinaclinic.ro", name: "Admin Retina", role: "admin" as const },
    ],
  },
  {
    name: "Clinic Dr. Holhoș",
    city: "Cluj-Napoca",
    doctors: [
      { email: "doctor@holhos.ro", name: "Dr. Demo Holhoș", role: "doctor" as const },
    ],
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  console.log("Seeding clinics and users...");
  console.log(`Default password for all seed users: ${SEED_PASSWORD}`);

  for (const clinic of clinicsSeed) {
    const existing = await db
      .select()
      .from(schema.clinics)
      .where(eq(schema.clinics.name, clinic.name))
      .limit(1);

    let clinicId: string;
    if (existing.length) {
      clinicId = existing[0].id;
      console.log(`  clinic exists: ${clinic.name}`);
    } else {
      const [created] = await db
        .insert(schema.clinics)
        .values({ name: clinic.name, city: clinic.city })
        .returning();
      clinicId = created.id;
      console.log(`  created clinic: ${clinic.name}`);
    }

    for (const doc of clinic.doctors) {
      const found = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, doc.email.toLowerCase()))
        .limit(1);

      if (found.length) {
        console.log(`    user exists: ${doc.email}`);
        continue;
      }

      await db.insert(schema.users).values({
        clinicId,
        email: doc.email.toLowerCase(),
        passwordHash,
        name: doc.name,
        role: doc.role,
      });
      console.log(`    created user: ${doc.email} (${doc.role})`);
    }
  }

  console.log("Seed complete.");
  await client.end();
}

main().catch(async (err) => {
  console.error(err);
  await client.end();
  process.exit(1);
});
