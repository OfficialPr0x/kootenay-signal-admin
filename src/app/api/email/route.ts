import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export async function GET() {
  const logs = await prisma.emailLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(logs);
}

export async function POST(request: NextRequest) {
  const { to, subject, html } = await request.json();

  if (!to || !subject || !html) {
    return NextResponse.json({ error: "to, subject, and html are required" }, { status: 400 });
  }

  const result = await sendEmail({ to, subject, html });

  // Log the email
  await prisma.emailLog.create({
    data: {
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      body: html,
      status: result.success ? "sent" : "failed",
      resendId: result.id || null,
    },
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: result.id }, { status: 201 });
}
