import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** URL-friendly random id without ambiguous characters. */
export function randomId(length: number): string {
  const bytes = randomBytes(length * 2);
  let out = "";
  for (let i = 0; out.length < length && i < bytes.length; i++) {
    const b = bytes[i];
    // Rejection sampling keeps the distribution uniform.
    if (b < Math.floor(256 / ALPHABET.length) * ALPHABET.length) {
      out += ALPHABET[b % ALPHABET.length];
    }
  }
  return out.length === length ? out : randomId(length);
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function secretMatches(secret: string | undefined, hash: string): boolean {
  if (!secret) return false;
  const a = Buffer.from(hashSecret(secret), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
