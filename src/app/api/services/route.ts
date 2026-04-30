import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET() {
  const { data: services, error } = await supabase
    .from("Service")
    .select("*")
    .order("price", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(services ?? []);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, description, price, features, isActive, isOneOff } = body;

  if (!name || !description || price === undefined) {
    return NextResponse.json({ error: "Name, description, and price are required" }, { status: 400 });
  }

  const { data: service, error } = await supabase
    .from("Service")
    .insert({
      name,
      description,
      price,
      features: JSON.stringify(features || []),
      isActive: isActive !== false,
      isOneOff: isOneOff === true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(service, { status: 201 });
}
