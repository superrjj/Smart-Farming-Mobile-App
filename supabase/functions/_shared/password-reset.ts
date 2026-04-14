/** Shared helpers for password-reset Edge Functions. */

export function getResetCodePepper(): string {
  const s = Deno.env.get("PASSWORD_RESET_SECRET")?.trim();
  if (s) return s;
  return "agrihydra-password-reset-default-pepper-set-PASSWORD_RESET_SECRET";
}

export async function hashPasswordResetCode(
  email: string,
  code: string,
): Promise<string> {
  const pepper = getResetCodePepper();
  const payload = `${email.trim()}|${code.trim()}|${pepper}`;
  const data = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateSixDigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
