import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import campaignsRouter from "./campaigns";
import casesRouter from "./cases";
import subscribersRouter from "./subscribers";
import aiRouter from "./ai";
import gamificationRouter from "./gamification";
import analyticsRouter from "./analytics";
import experimentsRouter from "./experiments";
import auditRouter from "./audit";
import usersRouter from "./users";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(campaignsRouter);
router.use(casesRouter);
router.use(subscribersRouter);
router.use(aiRouter);
router.use(gamificationRouter);
router.use(analyticsRouter);
router.use(experimentsRouter);
router.use(auditRouter);
router.use(usersRouter);

export default router;
