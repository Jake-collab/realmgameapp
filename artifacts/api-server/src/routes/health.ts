import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { serverReadiness } from "../lib/config";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/readiness", (_req, res) => {
  try {
    const readiness = serverReadiness();
    res.status(readiness.status === "failed" ? 503 : 200).json({
      ...readiness,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "failed",
      checks: [{ name: "Server configuration", status: "failed", summary: error instanceof Error ? error.message : "Invalid server configuration." }],
      checkedAt: new Date().toISOString(),
    });
  }
});

export default router;
