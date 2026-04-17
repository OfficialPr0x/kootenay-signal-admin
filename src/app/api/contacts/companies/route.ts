import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

// GET /api/contacts/companies - List companies
export async function GET() {
  const { data: companies } = await supabase
    .from("Company")
    .select("*")
    .order("name", { ascending: true });

  return NextResponse.json({ companies });
}
