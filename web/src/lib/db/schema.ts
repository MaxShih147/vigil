import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const allowedEmails = pgTable("allowed_emails", {
  email: text("email").primaryKey(),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  addedBy: text("added_by"),
});

export const accessRequests = pgTable("access_requests", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  reason: text("reason"),
  status: text("status").notNull().default("pending"), // pending | approved | denied
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decidedBy: text("decided_by"),
});
