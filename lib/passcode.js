import { scrypt, randomBytes, createHmac, createHash, createCipheriv, createDecipheriv, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// The share passcode, same scheme as Flows (lib/passcode.js). scrypt
// runs async on the threadpool so a flood of guesses at the public gate
// cannot freeze the event loop.
const scryptAsync = promisify(scrypt);

/** `salt$scrypt(passcode, salt)`, both hex. */
export async function hashPasscode(plain) {
  const salt = randomBytes(16);
  const key = await scryptAsync(plain, salt, 32);
  return `${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPasscode(plain, stored) {
  if (!stored || !stored.includes("$")) return false;
  const [saltHex, hashHex] = stored.split("$");
  if (!saltHex || !hashHex) return false;
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = await scryptAsync(plain, Buffer.from(saltHex, "hex"), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch { return false; }
}

// The unlock cookie is an HMAC of the board id and the CURRENT hash, so
// changing or removing the passcode voids every cookie already handed out.
function sign(boardId, hash) {
  return createHmac("sha256", process.env.AUTH_SECRET || "forensic-passcode").update(`${boardId}::${hash}`).digest("hex");
}

export const unlockToken = sign;

export function unlockCookieName(boardId) {
  return `forensic_unlock_${String(boardId).replace(/[^a-z0-9-]/gi, "")}`;
}

/** True when the request's cookie header holds a valid unlock for this board. */
export function isUnlocked(cookieHeader, boardId, hash) {
  const name = unlockCookieName(boardId);
  const part = String(cookieHeader || "").split(/;\s*/).find((p) => p.startsWith(`${name}=`));
  if (!part) return false;
  const a = Buffer.from(sign(boardId, hash), "hex");
  const b = Buffer.from(decodeURIComponent(part.slice(name.length + 1)), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// A readable copy for the owner's own Passcode box: AES-256-GCM under a key
// derived from AUTH_SECRET, stored as iv.tag.data (base64url). Only ever
// opened for the owner; a visitor's check still goes through the hash.
const sealKey = () => createHash("sha256").update(`forensic-passcode:${process.env.AUTH_SECRET || "forensic-passcode"}`).digest();

export function sealPasscode(plain) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", sealKey(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

/** The plain passcode, or "" when there is none or it will not open. */
export function openPasscode(sealed) {
  if (!sealed) return "";
  try {
    const [iv, tag, data] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
    const d = createDecipheriv("aes-256-gcm", sealKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString("utf8");
  } catch { return ""; }
}
