import { createApp } from "./app.js";
import { connectDb } from "./db.js";
import { backfillLegacyData } from "./departments.js";

const port = Number(process.env.PORT ?? 4000);

const source = await connectDb();
console.log(`[db] connected via ${source}`);

// Multi-department storage: assign any pre-refactor (unscoped) data
// to a department created from the Config identity fields.
await backfillLegacyData();

const app = createApp();
app.listen(port, "0.0.0.0", () => {
  console.log(`[server] Routine Maker API listening on http://0.0.0.0:${port}`);
});
