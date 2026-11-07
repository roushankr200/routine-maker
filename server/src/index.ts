import { createApp } from "./app.js";
import { connectDb } from "./db.js";

const port = Number(process.env.PORT ?? 4000);

const source = await connectDb();
console.log(`[db] connected via ${source}`);

const app = createApp();
app.listen(port, "0.0.0.0", () => {
  console.log(`[server] Routine Maker API listening on http://0.0.0.0:${port}`);
});
