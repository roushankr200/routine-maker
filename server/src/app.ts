import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { personalRoutineRouter, router } from "./routes.js";
import { accountRouter, authRouter, requireAccount, requireAdmin } from "./accounts.js";
import { roomRouter } from "./rooms.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ allowAnonymous = false } = {}): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/api/auth", authRouter);
  app.use("/api/me/routine", requireAccount, personalRoutineRouter);
  if (!allowAnonymous) app.use("/api", requireAccount, requireAdmin);
  app.use("/api/accounts", accountRouter);
  app.use("/api/rooms", roomRouter);
  app.use("/api", router);

  // JSON error handler for API routes.
  app.use("/api", (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err.message || "Internal server error" });
  });

  // Production: serve the built React client from the same service,
  // so one Render web service gives one URL.
  const clientDist = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientDist, "index.html"), (err) => {
      if (err) next();
    });
  });

  return app;
}
