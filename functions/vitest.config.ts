import { defineConfig } from "vitest/config";

export default defineConfig({
  // Emulator transactions can retry under concurrent test load on local machines.
  test: { testTimeout: 15000, hookTimeout: 30000, fileParallelism: false },
});
