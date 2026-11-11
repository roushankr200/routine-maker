import { defineConfig } from "vitest/config";

export default defineConfig({
  // fileParallelism is OFF: three suites boot in-memory MongoDB
  // (WiredTiger) instances, each needing ~100+ MB of dbPath, and
  // /tmp is a 512 MB tmpfs on this VM — running them in parallel
  // fills /tmp and mongod dies with fassert/invariant errors.
  // Sequential files cap peak usage at one instance. hookTimeout is
  // generous because mongod startup is slow on a small VM. (If a
  // run is still killed, clear stale /tmp/mongo-mem-* dirs.)
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
