import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  // Only allow setup if no users exist
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return NextResponse.json({ error: "Setup already completed" }, { status: 403 });
  }

  const { email, password, name } = await request.json();

  if (!email || !password || !name) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const hashed = await hashPassword(password);

  const user = await prisma.user.create({
    data: { email, password: hashed, name, role: "admin" },
  });

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
  });
}
