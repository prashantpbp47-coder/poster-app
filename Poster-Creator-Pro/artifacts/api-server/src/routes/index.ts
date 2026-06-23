import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import categoriesRouter from "./categories";
import templatesRouter from "./templates";
import subscriptionsRouter from "./subscriptions";
import adminRouter from "./admin";
import aiRouter from "./ai";
import postersRouter from "./posters";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(categoriesRouter);
router.use(templatesRouter);
router.use(subscriptionsRouter);
router.use(adminRouter);
router.use(aiRouter);
router.use(postersRouter);

export default router;
