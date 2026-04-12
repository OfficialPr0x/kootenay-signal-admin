import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const clientId = searchParams.get("clientId");

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;
  if (clientId) where.clientId = clientId;

  const invoices = await prisma.invoice.findMany({
    where,
    include: { client: { select: { name: true, business: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invoices);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { clientId, amount, dueDate } = body;

  if (!clientId || !amount || !dueDate) {
    return NextResponse.json({ error: "Client, amount, and due date are required" }, { status: 400 });
  }

  const invoice = await prisma.invoice.create({
    data: { clientId, amount, dueDate: new Date(dueDate) },
  });

  return NextResponse.json(invoice, { status: 201 });
}
