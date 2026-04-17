import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { verifyPassword, createToken } from "@/lib/auth";

const MASTER_ADMIN_ID = "master-admin";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  // Check master admin login from env
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PANEL_PASSWORD;

  if (adminEmail && adminPassword && email === adminEmail && password === adminPassword) {
    const token = await createToken(MASTER_ADMIN_ID);

    const response = NextResponse.json({
      user: { id: MASTER_ADMIN_ID, email: adminEmail, name: "Jaryd" },
    });

    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  }

  // Fallback to database user lookup
  const { data: user } = await supabase.from("User").select("*").eq("email", email).single();

  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.password);

  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createToken(user.id);

  const response = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
  });

  response.cookies.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });

  return response;
}
