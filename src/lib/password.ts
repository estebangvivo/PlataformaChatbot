import { createHash, randomBytes } from "crypto";

export const MIN_PASSWORD_LENGTH = 8;
const RESET_TTL_MS = 60 * 60 * 1000;

export function validateNewPassword(password: string, confirm?: string) {
  if (!password.trim() || password.length < MIN_PASSWORD_LENGTH) {
    return `Usá al menos ${MIN_PASSWORD_LENGTH} caracteres`;
  }
  if (typeof confirm === "string" && password !== confirm) {
    return "Las contraseñas no coinciden";
  }
  return null;
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newResetToken() {
  return randomBytes(32).toString("hex");
}

export function resetExpiry() {
  return new Date(Date.now() + RESET_TTL_MS);
}

export function appOrigin() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}