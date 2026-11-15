import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import type { MongoMemoryServer } from "mongodb-memory-server";

const localDataDir = fileURLToPath(new URL("../../.local/mongodb", import.meta.url));
let localMongo: MongoMemoryServer | undefined;

export async function connectDb(): Promise<string> {
  const uri = process.env.MONGODB_URI;
  if (uri) {
    await mongoose.connect(uri);
    return "MONGODB_URI";
  }
  // Keep production demos temporary when no external database is configured.
  const dbPath = process.env.NODE_ENV === "production" ? undefined : localDataDir;
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  if (dbPath) await mkdir(dbPath, { recursive: true });
  const mongod = await MongoMemoryServer.create({
    instance: { dbPath, storageEngine: "wiredTiger", ip: "127.0.0.1" },
  });
  try {
    await mongoose.connect(mongod.getUri("routine-maker"));
  } catch (error) {
    await mongod.stop();
    throw error;
  }
  localMongo = mongod;
  return dbPath ? `local MongoDB (${dbPath})` : "temporary MongoDB";
}

export async function disconnectDb(): Promise<void> {
  try {
    await mongoose.disconnect();
  } finally {
    await localMongo?.stop();
    localMongo = undefined;
  }
}
