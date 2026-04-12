import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { business: { contains: search } },
    ];
  }

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(leads);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const { name, email, phone, business, message, source } = body;

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const lead = await prisma.lead.create({
    data: { name, email, phone, business, message, source: source || "admin" },
  });

  return NextResponse.json(lead, { status: 201 });
}
