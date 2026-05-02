import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const COOKIE_NAME = "skymate_sid";
const COOKIE_MAX_AGE_DAYS = 30;

export async function getOrCreateSessionId(): Promise<{ sid: string; isNew: boolean }> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  if (existing) return { sid: existing, isNew: false };
  return { sid: randomUUID(), isNew: true };
}

export function applySessionCookie<T extends { cookies: { set: (name: string, value: string, opts?: object) => unknown } }>(
  response: T,
  sid: string,
): T {
  response.cookies.set(COOKIE_NAME, sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE_DAYS * 24 * 60 * 60,
    path: "/",
  });
  return response;
}
