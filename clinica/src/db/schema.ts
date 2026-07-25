import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["admin", "doctor"]);
export const sexEnum = pgEnum("sex", ["male", "female", "other", "unknown"]);
export const eyeEnum = pgEnum("eye", ["L", "R", "both", "unknown"]);
export const caseStatusEnum = pgEnum("case_status", [
  "pending_upload",
  "queued",
  "processing",
  "done",
  "failed",
]);

export const clinics = pgTable("clinics", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  city: varchar("city", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clinicId: uuid("clinic_id")
    .notNull()
    .references(() => clinics.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("doctor"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const patients = pgTable("patients", {
  id: uuid("id").defaultRandom().primaryKey(),
  clinicId: uuid("clinic_id")
    .notNull()
    .references(() => clinics.id, { onDelete: "cascade" }),
  externalRef: varchar("external_ref", { length: 128 }),
  birthYear: integer("birth_year"),
  sex: sexEnum("sex").notNull().default("unknown"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const cases = pgTable("cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  doctorId: uuid("doctor_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  clinicId: uuid("clinic_id")
    .notNull()
    .references(() => clinics.id, { onDelete: "cascade" }),
  imageKey: text("image_key"),
  eye: eyeEnum("eye").notNull().default("unknown"),
  status: caseStatusEnum("status").notNull().default("pending_upload"),
  attempts: integer("attempts").notNull().default(0),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  result: jsonb("result"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const clinicsRelations = relations(clinics, ({ many }) => ({
  users: many(users),
  patients: many(patients),
  cases: many(cases),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  clinic: one(clinics, {
    fields: [users.clinicId],
    references: [clinics.id],
  }),
  cases: many(cases),
}));

export const patientsRelations = relations(patients, ({ one, many }) => ({
  clinic: one(clinics, {
    fields: [patients.clinicId],
    references: [clinics.id],
  }),
  cases: many(cases),
}));

export const casesRelations = relations(cases, ({ one }) => ({
  patient: one(patients, {
    fields: [cases.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [cases.doctorId],
    references: [users.id],
  }),
  clinic: one(clinics, {
    fields: [cases.clinicId],
    references: [clinics.id],
  }),
}));

export type Clinic = typeof clinics.$inferSelect;
export type User = typeof users.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type Case = typeof cases.$inferSelect;
export type CaseResult = {
  confidences: Record<string, number>;
  narrative: string;
  model: string;
  completed_at: string;
};
