import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, appointments, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];

  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listAppointments(ownerOpenId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db
    .select()
    .from(appointments)
    .where(eq(appointments.ownerOpenId, ownerOpenId))
    .orderBy(asc(appointments.appointmentDate), asc(appointments.appointmentTime));
}

export async function getBookedSlots(appointmentDate: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db
    .select({ appointmentTime: appointments.appointmentTime })
    .from(appointments)
    .where(and(eq(appointments.appointmentDate, appointmentDate), eq(appointments.status, "booked")))
    .orderBy(asc(appointments.appointmentTime));
  return result.map(row => row.appointmentTime);
}

export async function createAppointment(input: {
  ownerOpenId: string;
  fullName: string;
  email: string;
  phone?: string;
  note?: string;
  appointmentDate: string;
  appointmentTime: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db.insert(appointments).values({
    ...input,
    phone: input.phone || null,
    note: input.note || null,
    activeSlotKey: `${input.appointmentDate}_${input.appointmentTime}`,
    status: "booked",
  });

  const created = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.appointmentDate, input.appointmentDate),
        eq(appointments.appointmentTime, input.appointmentTime),
        eq(appointments.status, "booked"),
        eq(appointments.ownerOpenId, input.ownerOpenId),
      ),
    )
    .limit(1);
  if (!created[0]) throw new Error("Appointment was created but could not be loaded");
  return created[0];
}

export async function cancelAppointment(id: number, ownerOpenId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .update(appointments)
    .set({ status: "cancelled", activeSlotKey: null, cancelledAt: new Date() })
    .where(and(eq(appointments.id, id), eq(appointments.ownerOpenId, ownerOpenId), eq(appointments.status, "booked")));
  const updated = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.ownerOpenId, ownerOpenId)))
    .limit(1);
  return updated[0];
}
