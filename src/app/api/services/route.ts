import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const services = await prisma.service.findMany();
  return NextResponse.json(services);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, description, price, features, isActive } = body;

  if (!name || !description || price === undefined) {
    return NextResponse.json({ error: "Name, description, and price are required" }, { status: 400 });
  }

  const service = await prisma.service.create({
    data: {
      name,
      description,
      price,
      features: JSON.stringify(features || []),
      isActive: isActive !== false,
    },
  });

  return NextResponse.json(service, { status: 201 });
}
