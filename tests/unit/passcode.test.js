import { describe, it, expect } from "vitest";
import { hashPasscode, verifyPasscode, unlockToken, unlockCookieName, isUnlocked, sealPasscode, openPasscode } from "../../lib/passcode.js";

const ID = "00000000-0000-0000-0000-000000000001";

describe("passcode hash", () => {
  it("round trips and rejects a wrong passcode", async () => {
    const stored = await hashPasscode("secret 1");
    expect(stored).toMatch(/^[0-9a-f]+\$[0-9a-f]+$/);
    expect(await verifyPasscode("secret 1", stored)).toBe(true);
    expect(await verifyPasscode("nope", stored)).toBe(false);
  });

  it("rejects a malformed stored value", async () => {
    expect(await verifyPasscode("x", null)).toBe(false);
    expect(await verifyPasscode("x", "nodollar")).toBe(false);
    expect(await verifyPasscode("x", "$")).toBe(false);
  });
});

describe("unlock cookie", () => {
  it("is valid for its own token and void once the hash changes", () => {
    const name = unlockCookieName(ID);
    expect(name).toBe(`forensic_unlock_${ID}`);
    const header = `a=1; ${name}=${unlockToken(ID, "hash-1")}`;
    expect(isUnlocked(header, ID, "hash-1")).toBe(true);
    expect(isUnlocked(header, ID, "hash-2")).toBe(false);
    expect(isUnlocked("a=1", ID, "hash-1")).toBe(false);
    expect(isUnlocked(undefined, ID, "hash-1")).toBe(false);
  });
});

describe("sealed passcode", () => {
  it("round trips, and gives an empty string for nothing or garbage", () => {
    expect(openPasscode(sealPasscode("secret 1"))).toBe("secret 1");
    expect(openPasscode("")).toBe("");
    expect(openPasscode("garbage")).toBe("");
  });
});
