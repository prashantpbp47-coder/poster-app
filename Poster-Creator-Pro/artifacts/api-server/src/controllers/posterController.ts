import { eq } from "drizzle-orm";
import { db, insertPosterSchema, posters } from "@workspace/db";
import type { InsertPoster } from "@workspace/db";

export function serializePoster(p: typeof posters.$inferSelect) {
  return {
    id: p.id,
    title: p.title,
    thumbnailUrl: p.thumbnailUrl,
    status: p.status,
    shareUrl: p.shareUrl,
    tags: p.tags,
    width: p.width,
    height: p.height,
    createdAt: p.createdAt?.toISOString() ?? null,
    updatedAt: p.updatedAt?.toISOString() ?? null,
  };
}

export async function createPoster(data: InsertPoster) {
  const [poster] = await db.insert(posters).values(data).returning();
  return serializePoster(poster);
}

export async function getPosterById(id: number) {
  const [poster] = await db.select().from(posters).where(eq(posters.id, id));
  return poster ? serializePoster(poster) : null;
}

export async function listPosters() {
  const posterRows = await db.select().from(posters).orderBy(posters.id);
  return posterRows.map(serializePoster);
}

export async function updatePosterById(id: number, data: Partial<InsertPoster>) {
  const [poster] = await db.update(posters).set(data).where(eq(posters.id, id)).returning();
  return poster ? serializePoster(poster) : null;
}

export async function deletePosterById(id: number) {
  const [poster] = await db.delete(posters).where(eq(posters.id, id)).returning();
  return Boolean(poster);
}
