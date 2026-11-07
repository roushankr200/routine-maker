import mongoose from "mongoose";

/**
 * Database connection.
 *
 * - Production: set MONGODB_URI (e.g. a MongoDB Atlas connection string).
 * - Local dev / demo: if MONGODB_URI is not set, we spin up an in-memory
 *   MongoDB via mongodb-memory-server — zero setup, `npm run dev` just
 *   works. Data lives only while the process runs in that mode.
 */
export async function connectDb(): Promise<string> {
  const uri = process.env.MONGODB_URI;
  if (uri) {
    await mongoose.connect(uri);
    return "MONGODB_URI";
  }
  // Lazy import so production installs don't need the binary download path
  // unless the fallback is actually used.
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("routine-maker"));
  console.warn(
    "[db] MONGODB_URI not set — using in-memory MongoDB (data resets on restart).",
  );
  return "mongodb-memory-server";
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
