import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { getEnv } from "@/lib/env";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

function keyBuffer(): Buffer {
  return Buffer.from(getEnv().ENCRYPTION_KEY, "hex");
}

/** AES-256-GCM encrypt — returns base64(iv:tag:ciphertext) */
export function encryptAtRest(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, keyBuffer(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptAtRest(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + 16);
  const data = buf.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGO, keyBuffer(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}
