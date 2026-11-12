import { describe, expect, it, vi } from "vitest";

import { withFileRetry } from "./fileRetry";

// the game, another mod manager or an antivirus scanner can hold these files for a moment
describe("withFileRetry", () => {
  const failing = (code: string, times: number) => {
    let calls = 0;
    return vi.fn(() => {
      calls += 1;
      return calls <= times
        ? Promise.reject(Object.assign(new Error(`${code}: busy`), { code }))
        : Promise.resolve("written");
    });
  };

  it("completes the operation once the process holding the file lets go", async () => {
    const operation = failing("EBUSY", 2);

    await expect(withFileRetry(operation)).resolves.toBe("written");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("gives up once the attempts are spent", async () => {
    const operation = failing("EBUSY", 99);

    await expect(withFileRetry(operation)).rejects.toThrow("EBUSY");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("keeps trying for the attempts it is given", async () => {
    const operation = failing("EPERM", 4);

    await expect(withFileRetry(operation, 5)).resolves.toBe("written");
    expect(operation).toHaveBeenCalledTimes(5);
  });

  // a read-only filesystem will not become writable by waiting
  it("reports a failure that holding the file cannot explain straight away", async () => {
    const operation = failing("EROFS", 99);

    await expect(withFileRetry(operation)).rejects.toThrow("EROFS");
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
