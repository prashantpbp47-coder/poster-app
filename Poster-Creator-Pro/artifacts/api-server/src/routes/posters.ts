import { Router, type IRouter } from "express";
import { insertPosterSchema } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import {
  createPoster,
  deletePosterById,
  getPosterById,
  listPosters,
  updatePosterById,
} from "../controllers/posterController";

const router: IRouter = Router();

const updatePosterSchema = insertPosterSchema.partial();

router.get("/posters", async (_req, res): Promise<void> => {
  const posters = await listPosters();
  res.json(posters);
});

router.get("/posters/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id) || id <= 0) {
    res.status(400).json({ error: "Invalid poster id" });
    return;
  }

  const poster = await getPosterById(id);
  if (!poster) {
    res.status(404).json({ error: "Poster not found" });
    return;
  }

  res.json(poster);
});

router.post("/posters", requireAuth, async (req, res): Promise<void> => {
  const parsed = insertPosterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const poster = await createPoster(parsed.data);
  res.status(201).json(poster);
});

router.patch("/posters/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id) || id <= 0) {
    res.status(400).json({ error: "Invalid poster id" });
    return;
  }

  const parsed = updatePosterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const poster = await updatePosterById(id, parsed.data);
  if (!poster) {
    res.status(404).json({ error: "Poster not found" });
    return;
  }

  res.json(poster);
});

router.delete("/posters/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id) || id <= 0) {
    res.status(400).json({ error: "Invalid poster id" });
    return;
  }

  const deleted = await deletePosterById(id);
  if (!deleted) {
    res.status(404).json({ error: "Poster not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
