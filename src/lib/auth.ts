import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { supabase } from "./db";
import bcrypt from "bcryptjs";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "fallback-secret");

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createToken(userId: string) {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { userId: string };
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  // Master admin login via env
  if (payload.userId === "master-admin") {
    return {
      id: "master-admin",
      email: process.env.ADMIN_EMAIL || "admin@kootenaysignal.com",
      name: "Jaryd",
      role: "admin",
    };
  }

  const { data: user } = await supabase
    .from("User")
    .select("id, email, name, role")
    .eq("id", payload.userId)
    .single();

  return user;
}
