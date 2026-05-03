import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { InvoicePDF } from "@/lib/invoice-pdf";
import { Resend } from "resend";
import React from "react";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || "Kootenay Signal <onboarding@resend.dev>";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: inv, error } = await supabase
    .from("Invoice")
    .select("*, Client(name, business, email, phone, website)")
    .eq("id", id)
    .single();

  if (error || !inv) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const invoice = { ...inv, client: inv.Client };
  const shortId = id.slice(-8).toUpperCase();
  const clientEmail = invoice.client?.email;

  if (!clientEmail) {
    return NextResponse.json({ error: "Client has no email address" }, { status: 400 });
  }

  // Generate PDF
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(React.createElement(InvoicePDF, { invoice }) as React.ReactElement<DocumentProps>);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "PDF generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const dueDate = new Date(invoice.dueDate).toLocaleDateString("en-CA", {
    year: "numeric", month: "long", day: "numeric",
  });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#03050a;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#03050a;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#0d1117;border-radius:10px;overflow:hidden;border:1px solid #1c2333;">
        <!-- Header -->
        <tr>
          <td style="background:#07090c;padding:24px 36px 22px;border-bottom:2px solid #e87f24;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;padding-right:12px;">
                  <img src="https://res.cloudinary.com/doajstql7/image/upload/q_auto/f_auto/v1777003162/f3d21215-ada9-4ea3-b86d-510a6885c8f5-removebg-preview_uat1ay.png" width="40" height="40" alt="Kootenay Signal" style="display:block;" />
                </td>
                <td style="vertical-align:middle;">
                  <span style="font-size:20px;font-weight:700;color:#e87f24;letter-spacing:0.5px;">Kootenay Signal</span><br>
                  <span style="font-size:9px;color:#6b7789;letter-spacing:1.5px;text-transform:uppercase;">Control Your Signal</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#dce3ed;">Invoice KS-${shortId}</p>
            <p style="margin:0 0 28px;font-size:13px;color:#6b7789;">Hi ${invoice.client.name}, please find your invoice attached.</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#07090c;border-radius:8px;margin-bottom:28px;border:1px solid #1c2333;overflow:hidden;">
              <tr>
                <td style="padding:14px 18px;border-bottom:1px solid #1c2333;border-right:1px solid #1c2333;">
                  <span style="font-size:10px;color:#6b7789;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:4px;">Invoice #</span>
                  <strong style="font-size:13px;color:#dce3ed;">KS-${shortId}</strong>
                </td>
                <td style="padding:14px 18px;border-bottom:1px solid #1c2333;border-right:1px solid #1c2333;">
                  <span style="font-size:10px;color:#6b7789;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:4px;">Amount Due</span>
                  <strong style="font-size:14px;color:#e87f24;">$${invoice.amount.toFixed(2)}</strong>
                </td>
                <td style="padding:14px 18px;border-bottom:1px solid #1c2333;">
                  <span style="font-size:10px;color:#6b7789;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:4px;">Due Date</span>
                  <strong style="font-size:13px;color:#dce3ed;">${dueDate}</strong>
                </td>
              </tr>
              ${invoice.description ? `<tr><td colspan="3" style="padding:12px 18px;font-size:12px;color:#6b7789;">${invoice.description}</td></tr>` : ""}
            </table>

            <p style="margin:0 0 24px;font-size:13px;color:#8892a0;line-height:1.7;">
              Your invoice is attached as a PDF. If you have any questions, reply to this email or reach out at
              <a href="mailto:jaryd@kootenaysignal.com" style="color:#e87f24;text-decoration:none;">jaryd@kootenaysignal.com</a>.
            </p>

            <p style="margin:0;font-size:13px;color:#8892a0;">
              Thank you for your business,<br>
              <strong style="color:#dce3ed;">Kootenay Signal</strong>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#07090c;padding:16px 36px;border-top:1px solid #1c2333;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <img src="https://res.cloudinary.com/doajstql7/image/upload/q_auto/f_auto/v1777003162/f3d21215-ada9-4ea3-b86d-510a6885c8f5-removebg-preview_uat1ay.png" width="18" height="18" alt="" style="display:inline;vertical-align:middle;margin-right:6px;" />
                  <span style="font-size:11px;color:#6b7789;vertical-align:middle;">Kootenay Signal · kootenaysignal.com</span>
                </td>
                <td align="right">
                  <span style="font-size:11px;color:#6b7789;">Invoice KS-${shortId}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const { error: sendError } = await resend.emails.send({
    from: FROM,
    to: clientEmail,
    subject: `Invoice KS-${shortId} — $${invoice.amount.toFixed(2)} due ${dueDate}`,
    html,
    attachments: [
      {
        filename: `KS-Invoice-${shortId}.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  if (sendError) {
    return NextResponse.json({ error: (sendError as { message?: string }).message || "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ success: true, sentTo: clientEmail });
}
