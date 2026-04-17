import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { sendEmail } from "@/lib/email";

// Public webhook for the main Kootenay Signal site to submit leads
// No auth required - this is called from the public contact form
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, email, phone, business, message } = body;

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  // Create lead
  const { data: lead, error } = await supabase
    .from("Lead")
    .insert({
      name,
      email,
      phone: phone || null,
      business: business || null,
      message: message || null,
      source: "website",
      status: "new",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send notification email to admin
  const adminNotificationHtml = `
    <h2>New Lead from Kootenay Signal</h2>
    <table style="border-collapse: collapse; width: 100%;">
      <tr><td style="padding: 8px; font-weight: bold;">Name:</td><td style="padding: 8px;">${name}</td></tr>
      <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;">${email}</td></tr>
      ${phone ? `<tr><td style="padding: 8px; font-weight: bold;">Phone:</td><td style="padding: 8px;">${phone}</td></tr>` : ""}
      ${business ? `<tr><td style="padding: 8px; font-weight: bold;">Business:</td><td style="padding: 8px;">${business}</td></tr>` : ""}
      ${message ? `<tr><td style="padding: 8px; font-weight: bold;">Message:</td><td style="padding: 8px;">${message}</td></tr>` : ""}
    </table>
  `;

  // Send email notification (non-blocking, don't fail if email fails)
  sendEmail({
    to: process.env.ADMIN_EMAIL || "admin@kootenaysignal.com",
    subject: `New Lead: ${name} - ${business || "No Business"}`,
    html: adminNotificationHtml,
    idempotencyKey: `new-lead/${lead.id}`,
  }).catch(console.error);

  return NextResponse.json({ success: true, id: lead.id }, { status: 201 });
}
