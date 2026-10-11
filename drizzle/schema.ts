import { index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/** Core user table backing the supplied auth flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const appointments = mysqlTable(
  "appointments",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerOpenId: varchar("ownerOpenId", { length: 64 }),
    fullName: varchar("fullName", { length: 160 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    note: text("note"),
    appointmentDate: varchar("appointmentDate", { length: 10 }).notNull(),
    appointmentTime: varchar("appointmentTime", { length: 5 }).notNull(),
    /** A date/time key only while the appointment is active; NULL after cancellation. */
    activeSlotKey: varchar("activeSlotKey", { length: 16 }),
    /** Retained for backwards compatibility with the pre-login visitor-key migration. */
    visitorKey: varchar("visitorKey", { length: 64 }),
    status: mysqlEnum("status", ["booked", "cancelled"]).default("booked").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    cancelledAt: timestamp("cancelledAt"),
  },
  table => ({
    activeSlotUnique: uniqueIndex("appointments_active_slot_unique").on(table.activeSlotKey),
    dateIndex: index("appointments_date_idx").on(table.appointmentDate),
    visitorIndex: index("appointments_visitor_idx").on(table.visitorKey),
    ownerIndex: index("appointments_owner_idx").on(table.ownerOpenId),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;
