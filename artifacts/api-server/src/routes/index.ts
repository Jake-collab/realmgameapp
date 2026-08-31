import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import revenueCatRouter from "./revenuecat";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminRouter);
router.use(revenueCatRouter);

export default router;
