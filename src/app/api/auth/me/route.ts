import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(session);
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, email } = await request.json();

  const user = await prisma.user.update({
    where: { id: session.id },
    data: {
      ...(name && { name }),
      ...(email && { email }),
    },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json(user);
}
