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

  const clients = await prisma.client.findMany({
    where,
    include: { invoices: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(clients);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, email, phone, business, website, plan, monthlyRate, notes } = body;

  if (!name || !email || !business) {
    return NextResponse.json({ error: "Name, email, and business are required" }, { status: 400 });
  }

  const client = await prisma.client.create({
    data: { name, email, phone, business, website, plan, monthlyRate: monthlyRate || 0, notes },
  });

  return NextResponse.json(client, { status: 201 });
}
