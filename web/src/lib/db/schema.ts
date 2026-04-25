import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";

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

export const devices = pgTable("devices", {
  // device_id from pi/config/vigil.yaml › device.id
  id: text("id").primaryKey(),
  label: text("label"),
  location: text("location"),
  // latest reported state (overwritten each heartbeat)
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  recording: boolean("recording").default(false).notNull(),
  diskUsedPct: integer("disk_used_pct"),
  diskFreeGb: integer("disk_free_gb"),
  pendingUploads: integer("pending_uploads"),
  lastUploadAt: timestamp("last_upload_at", { withTimezone: true }),
  ip: text("ip"),
  vigilVersion: text("vigil_version"),
  // metadata that rarely changes
  registeredAt: timestamp("registered_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  notes: text("notes"),
});

export const deviceCommands = pgTable("device_commands", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id")
    .notNull()
    .references(() => devices.id, { onDelete: "cascade" }),
  command: text("command").notNull(), // start_recording | stop_recording | restart_recorder | restart_uploader | force_upload_now
  payload: jsonb("payload"), // optional structured args
  status: text("status").notNull().default("pending"), // pending | sent | done | failed
  result: jsonb("result"), // {ok: bool, message?: string, data?: any}
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  doneAt: timestamp("done_at", { withTimezone: true }),
  issuedBy: text("issued_by"), // admin email
});
