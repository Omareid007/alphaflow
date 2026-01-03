import { beforeAll, afterAll, afterEach } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

declare global {
  var testUtils: {
    waitFor: (condition: () => boolean, timeout?: number) => Promise<void>;
  };
}

global.testUtils = {
  async waitFor(
    condition: () => boolean,
    timeout: number = 5000
  ): Promise<void> {
    const start = Date.now();
    while (!condition() && Date.now() - start < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!condition()) {
      throw new Error("Condition not met within timeout");
    }
  },
};

beforeAll(async () => {
  console.log("Test suite starting...");
});

afterAll(async () => {
  console.log("Test suite complete.");
});

afterEach(() => {});
