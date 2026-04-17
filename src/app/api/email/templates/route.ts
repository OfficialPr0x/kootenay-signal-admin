import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET() {
  const { data: templates, error } = await supabase
    .from("EmailTemplate")
    .select("*")
    .order("updatedAt", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, subject, bodyHtml, category } = body;

  if (!name || !subject || !bodyHtml) {
    return NextResponse.json(
      { error: "name, subject, and bodyHtml are required" },
      { status: 400 }
    );
  }

  const { data: template, error } = await supabase
    .from("EmailTemplate")
    .insert({ name, subject, bodyHtml, category })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(template, { status: 201 });
}
