import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const posters = pgTable("posters", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  status: text("status").default("draft"),
  shareUrl: text("share_url"),
  tags: text("tags"),
  width: integer("width"),
  height: integer("height"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPosterSchema = createInsertSchema(posters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPoster = z.infer<typeof insertPosterSchema>;
export type Poster = typeof posters.$inferSelect;
