import { createApp } from "./app.js";
import { connectDb, disconnectDb } from "./db.js";
import { backfillLegacyData } from "./departments.js";
import { prepareAccounts } from "./accounts.js";
import { addDefaultRooms } from "./rooms.js";
import { Department } from "./models.js";
import { loadDemoData } from "./seed.js";
import { normalizeSavedLabSessions } from "./savedLabSessions.js";

const port = Number(process.env.PORT ?? 4000);

const source = await connectDb();
console.log(`[db] connected via ${source}`);

// Multi-department storage: assign any pre-refactor (unscoped) data
// to a department created from the Config identity fields.
await backfillLegacyData();
if (!(await Department.exists({}))) await loadDemoData();
const removedLabHours = await normalizeSavedLabSessions();
if (removedLabHours) console.log(`[routine] Removed ${removedLabHours} hours from extra saved lab sessions.`);
await Promise.all([prepareAccounts(), addDefaultRooms()]);

const app = createApp();
const host = process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";
const server = app.listen(port, host, () => {
  console.log(`[server] Routine Maker API listening on http://${host}:${port}`);
});

function shutdown() {
  if (!server.listening) return;
  server.close(() => {
    void disconnectDb().catch((error) => {
      console.error("[db] Shutdown failed:", error);
      process.exitCode = 1;
    });
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
