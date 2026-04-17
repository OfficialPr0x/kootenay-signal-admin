/**
 * Agent Tool Executor
 *
 * Runs actual tool calls against the real backend.
 * Every function here is the production implementation
 * that the AI agent invokes through the orchestrator.
 */

import { supabase } from "@/lib/db";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.FROM_EMAIL || "Kootenay Signal <onboarding@resend.dev>";
const replyToEmail = process.env.ADMIN_EMAIL || "jaryd@kootenaysignal.com";

export type ToolResult = {
  success: boolean;
  data?: unknown;
  error?: string;
};

type ToolInput = Record<string, unknown>;

// ── Master dispatcher ──

export async function executeTool(name: string, input: ToolInput): Promise<ToolResult> {
  const executor = TOOL_EXECUTORS[name];
  if (!executor) {
    return { success: false, error: `Unknown tool: ${name}` };
  }
  try {
    return await executor(input);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Tool execution failed" };
  }
}

// ── Tool implementations ──

const TOOL_EXECUTORS: Record<string, (input: ToolInput) => Promise<ToolResult>> = {

  // ═══════ CONTACTS ═══════

  async find_contacts(input) {
    const query = input.query as string;
    const stage = input.stage as string | undefined;
    const status = input.status as string | undefined;
    const limit = (input.limit as number) || 20;

    let q = supabase.from("EmailContact").select("*").order("updatedAt", { ascending: false }).limit(limit);
    if (query) {
      q = q.or(`name.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%,tags.ilike.%${query}%`);
    }
    if (stage) q = q.eq("pipelineStage", stage);
    if (status) q = q.eq("status", status);

    const { data: contacts } = await q;
    return { success: true, data: { contacts: contacts || [], count: (contacts || []).length } };
  },

  async get_contact(input) {
    let q = supabase.from("EmailContact").select("*, ContactActivity(*), CampaignContact(*, EmailCampaign(name, status)), ContactScore(*)");
    if (input.id) q = q.eq("id", input.id as string);
    else q = q.eq("email", input.email as string);

    const { data: contact } = await q.single();
    if (!contact) return { success: false, error: "Contact not found" };

    const { ContactActivity, CampaignContact, ContactScore, ...rest } = contact;
    return {
      success: true,
      data: {
        ...rest,
        activities: ContactActivity || [],
        campaignContacts: (CampaignContact || []).map((cc: Record<string, unknown>) => {
          const { EmailCampaign, ...ccRest } = cc;
          return { ...ccRest, campaign: EmailCampaign };
        }),
        scores: ContactScore || [],
      },
    };
  },

  async update_contact_tags(input) {
    const { data: contact } = await supabase.from("EmailContact").select("id, tags").eq("id", input.contactId as string).single();
    if (!contact) return { success: false, error: "Contact not found" };

    const currentTags = contact.tags ? contact.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [];
    const addTags = (input.addTags as string[]) || [];
    const removeTags = (input.removeTags as string[]) || [];

    const newTags = [...new Set([...currentTags, ...addTags])].filter(t => !removeTags.includes(t));

    await supabase.from("EmailContact").update({ tags: newTags.join(",") }).eq("id", input.contactId as string);
    return { success: true, data: { id: contact.id, tags: newTags } };
  },

  async move_contact_stage(input) {
    await supabase.from("EmailContact").update({ pipelineStage: input.stage as string }).eq("id", input.contactId as string);

    await supabase.from("ContactActivity").insert({
      contactId: input.contactId as string,
      type: "stage_change",
      title: `Moved to ${input.stage} by AI agent`,
    });

    return { success: true, data: { id: input.contactId, stage: input.stage } };
  },

  async list_prospect_list(input) {
    const limit = (input.limit as number) || 50;
    const { data: contacts } = await supabase
      .from("EmailContact")
      .select("*")
      .in("pipelineStage", ["new", "contacted"])
      .eq("status", "subscribed")
      .order("leadScore", { ascending: false })
      .limit(limit);
    return { success: true, data: { contacts: contacts || [], count: (contacts || []).length } };
  },

  // ═══════ EMAIL SEND ═══════

  async compose_email_draft(input) {
    return {
      success: true,
      data: {
        draft: {
          to: input.to,
          subject: input.subject,
          body: input.body,
          from: input.fromMailbox || fromEmail,
          tags: input.tags || [],
        },
        message: "Draft composed. Use send_single_email or send_bulk_email_batch to send.",
      },
    };
  },

  async send_single_email(input) {
    const body = (input.body as string) || "<p>Hello from Kootenay Signal</p>";
    const { data, error } = await resend.emails.send({
      from: (input.fromMailbox as string) || fromEmail,
      replyTo: replyToEmail,
      to: [input.to as string],
      subject: (input.subject as string) || "Quick note from Kootenay Signal",
      html: body,
      tags: ((input.tags as string[]) || []).map(t => ({ name: "tag", value: t })),
    });

    if (error) return { success: false, error: error.message };

    await supabase.from("EmailMessage").insert({
      resendId: data?.id,
      direction: "outbound",
      fromEmail: (input.fromMailbox as string) || fromEmail,
      toEmail: input.to as string,
      subject: input.subject as string,
      bodyHtml: input.body as string,
      status: "sent",
      tags: ((input.tags as string[]) || []).join(","),
    });

    return { success: true, data: { resendId: data?.id, to: input.to, subject: input.subject } };
  },

  async send_bulk_email_batch(input) {
    const contactIds = input.contactIds as string[];
    const { data: contacts } = await supabase
      .from("EmailContact")
      .select("*")
      .in("id", contactIds)
      .eq("status", "subscribed");

    if (!contacts || contacts.length === 0) return { success: false, error: "No valid contacts found" };

    const results: { email: string; success: boolean; resendId?: string; error?: string }[] = [];

    for (const contact of contacts) {
      try {
        const { data, error } = await resend.emails.send({
          from: (input.fromMailbox as string) || fromEmail,
          replyTo: replyToEmail,
          to: [contact.email],
          subject: input.subject as string,
          html: (input.body as string).replace(/\{\{name\}\}/g, contact.name || "there"),
          tags: ((input.tags as string[]) || []).map(t => ({ name: "tag", value: t })),
        });

        if (error) {
          results.push({ email: contact.email, success: false, error: error.message });
          continue;
        }

        await supabase.from("EmailMessage").insert({
          resendId: data?.id,
          direction: "outbound",
          fromEmail: (input.fromMailbox as string) || fromEmail,
          toEmail: contact.email,
          subject: input.subject as string,
          bodyHtml: input.body as string,
          status: "sent",
          tags: ((input.tags as string[]) || []).join(","),
        });

        results.push({ email: contact.email, success: true, resendId: data?.id });

        // Stagger sends
        const stagger = ((input.staggerMinutes as number) || 0) * 1000;
        if (stagger > 0) await new Promise(r => setTimeout(r, stagger));
      } catch (err) {
        results.push({ email: contact.email, success: false, error: err instanceof Error ? err.message : "Unknown" });
      }
    }

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    return { success: true, data: { sent, failed, total: contacts.length, results } };
  },

  async pause_campaign(input) {
    await supabase.from("EmailCampaign").update({ status: "paused" }).eq("id", input.campaignId as string);
    return { success: true, data: { id: input.campaignId, status: "paused" } };
  },

  async resume_campaign(input) {
    await supabase.from("EmailCampaign").update({ status: "active" }).eq("id", input.campaignId as string);
    return { success: true, data: { id: input.campaignId, status: "active" } };
  },

  // ═══════ INBOX ═══════

  async search_inbox_threads(input) {
    let q = supabase.from("EmailMessage").select("id, direction, fromEmail, toEmail, subject, status, threadId, isRead, createdAt")
      .order("createdAt", { ascending: false })
      .limit((input.limit as number) || 20);

    if (input.direction) q = q.eq("direction", input.direction as string);
    if (input.status) q = q.eq("status", input.status as string);
    if (input.since) q = q.gte("createdAt", new Date(input.since as string).toISOString());
    if (input.query) {
      q = q.or(`subject.ilike.%${input.query}%,fromEmail.ilike.%${input.query}%,bodyText.ilike.%${input.query}%`);
    }

    const { data: messages } = await q;
    return { success: true, data: { threads: messages || [], count: (messages || []).length } };
  },

  async get_thread(input) {
    const { data: messages } = await supabase
      .from("EmailMessage")
      .select("*, EmailEvent(*)")
      .or(`threadId.eq.${input.threadId},id.eq.${input.threadId}`)
      .order("createdAt", { ascending: true });

    if (!messages || messages.length === 0) return { success: false, error: "Thread not found" };

    const shaped = messages.map((m: Record<string, unknown>) => {
      const { EmailEvent, ...rest } = m;
      return { ...rest, events: EmailEvent || [] };
    });
    return { success: true, data: { messages: shaped } };
  },

  async draft_reply(input) {
    const { data: original } = await supabase.from("EmailMessage").select("*").eq("id", input.messageId as string).single();
    if (!original) return { success: false, error: "Message not found" };

    return {
      success: true,
      data: {
        draft: {
          inReplyTo: original.id,
          to: original.direction === "inbound" ? original.fromEmail : original.toEmail,
          subject: input.subject || `Re: ${original.subject}`,
          body: input.body,
          threadId: original.threadId || original.id,
        },
      },
    };
  },

  async send_reply(input) {
    const { data: original } = await supabase.from("EmailMessage").select("*").eq("id", input.messageId as string).single();
    if (!original) return { success: false, error: "Message not found" };

    const to = original.direction === "inbound" ? original.fromEmail : original.toEmail;

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      replyTo: replyToEmail,
      to: [to],
      subject: `Re: ${original.subject}`,
      html: input.body as string,
    });

    if (error) return { success: false, error: error.message };

    const { data: reply } = await supabase.from("EmailMessage").insert({
      resendId: data?.id,
      direction: "outbound",
      fromEmail: fromEmail.replace(/<|>/g, "").split(" ").pop() || fromEmail,
      toEmail: to,
      subject: `Re: ${original.subject}`,
      bodyHtml: input.body as string,
      status: "sent",
      threadId: original.threadId || original.id,
      inReplyTo: original.id,
    }).select().single();

    return { success: true, data: { replyId: reply?.id, resendId: data?.id, to, subject: `Re: ${original.subject}` } };
  },

  // ═══════ WARMUP / DELIVERABILITY ═══════

  async list_mailboxes() {
    const { data: mailboxes } = await supabase
      .from("EmailAccount")
      .select("*, MailboxHealthSnapshot(*), WarmupJob(*, WarmupProfile(*))");

    return {
      success: true,
      data: {
        mailboxes: (mailboxes || []).map((m: Record<string, unknown>) => {
          const snapshots = (m.MailboxHealthSnapshot as unknown[]) || [];
          const jobs = (m.WarmupJob as Array<Record<string, unknown>>) || [];
          return {
            id: m.id,
            email: m.email,
            name: m.name,
            warmupStatus: m.warmupStatus,
            trustScore: m.trustScore,
            dailySendLimit: m.dailySendLimit,
            currentVolume: m.currentVolume,
            lastHealth: snapshots.length > 0 ? snapshots[0] : null,
            activeProfile: jobs.length > 0 ? (jobs[0].WarmupProfile as Record<string, unknown>)?.name || null : null,
          };
        }),
      },
    };
  },

  async get_mailbox_health(input) {
    const { data: mailbox } = await supabase
      .from("EmailAccount")
      .select("*, MailboxHealthSnapshot(*), WarmupJob(*, WarmupProfile(*))")
      .eq("id", input.mailboxId as string)
      .single();
    if (!mailbox) return { success: false, error: "Mailbox not found" };

    const jobs = (mailbox.WarmupJob as Array<Record<string, unknown>>) || [];
    return {
      success: true,
      data: {
        id: mailbox.id,
        email: mailbox.email,
        warmupStatus: mailbox.warmupStatus,
        trustScore: mailbox.trustScore,
        dailySendLimit: mailbox.dailySendLimit,
        healthHistory: mailbox.MailboxHealthSnapshot || [],
        activeJobs: jobs.filter((j: Record<string, unknown>) => j.status === "active"),
      },
    };
  },

  async pause_warmup(input) {
    await supabase.from("EmailAccount").update({ warmupStatus: "paused" }).eq("id", input.mailboxId as string);
    const { data: jobs } = await supabase
      .from("WarmupJob")
      .update({ status: "paused" })
      .eq("mailboxId", input.mailboxId as string)
      .eq("status", "active")
      .select("id");
    return { success: true, data: { mailboxId: input.mailboxId, paused: true, jobsPaused: (jobs || []).length } };
  },

  async resume_warmup(input) {
    await supabase.from("EmailAccount").update({ warmupStatus: "warming" }).eq("id", input.mailboxId as string);
    const { data: jobs } = await supabase
      .from("WarmupJob")
      .update({ status: "active" })
      .eq("mailboxId", input.mailboxId as string)
      .eq("status", "paused")
      .select("id");
    return { success: true, data: { mailboxId: input.mailboxId, resumed: true, jobsResumed: (jobs || []).length } };
  },

  async set_warmup_volume(input) {
    await supabase.from("EmailAccount").update({ dailySendLimit: input.dailyVolume as number }).eq("id", input.mailboxId as string);
    return { success: true, data: { mailboxId: input.mailboxId, dailySendLimit: input.dailyVolume } };
  },

  async get_domain_health(input) {
    const domain = input.domain as string;
    const { data: snapshots } = await supabase
      .from("DeliverabilitySnapshot")
      .select("*")
      .eq("domain", domain)
      .order("createdAt", { ascending: false })
      .limit(5);

    const { data: mailboxes } = await supabase
      .from("EmailAccount")
      .select("id, email, warmupStatus, trustScore")
      .ilike("email", `%@${domain}`);

    return {
      success: true,
      data: {
        domain,
        snapshots: snapshots || [],
        mailboxes: mailboxes || [],
        summary: (snapshots && snapshots[0]) || { overallScore: 0, spfStatus: "unknown", dkimStatus: "unknown", dmarcStatus: "unknown" },
      },
    };
  },

  // ═══════ INVOICING ═══════

  async find_client(input) {
    const query = input.query as string;
    const { data: clients } = await supabase
      .from("Client")
      .select("*, Invoice(*)")
      .or(`name.ilike.%${query}%,email.ilike.%${query}%,business.ilike.%${query}%`)
      .limit(10);

    const shaped = (clients || []).map((c: Record<string, unknown>) => {
      const { Invoice, ...rest } = c;
      return { ...rest, invoices: Invoice || [] };
    });
    return { success: true, data: { clients: shaped, count: shaped.length } };
  },

  async create_invoice_draft(input) {
    const { data: client } = await supabase.from("Client").select("*").eq("id", input.clientId as string).single();
    if (!client) return { success: false, error: "Client not found" };

    const amount = (input.amount as number) || client.monthlyRate;
    const dueDate = input.dueDate ? new Date(input.dueDate as string) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const { data: invoice } = await supabase.from("Invoice").insert({
      clientId: client.id,
      amount,
      status: "pending",
      dueDate: dueDate.toISOString(),
    }).select().single();

    return {
      success: true,
      data: {
        invoiceId: invoice?.id,
        client: { name: client.name, email: client.email, business: client.business },
        amount,
        dueDate: dueDate.toISOString(),
        status: "pending",
      },
    };
  },

  async send_invoice(input) {
    const { data: invoice } = await supabase
      .from("Invoice")
      .select("*, Client(*)")
      .eq("id", input.invoiceId as string)
      .single();
    if (!invoice) return { success: false, error: "Invoice not found" };

    const client = invoice.Client as Record<string, unknown>;

    const { error } = await resend.emails.send({
      from: fromEmail,
      replyTo: replyToEmail,
      to: [client.email as string],
      subject: `Invoice from Kootenay Signal — $${(invoice.amount as number).toFixed(2)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Invoice from Kootenay Signal</h2>
          <p>Hi ${client.name},</p>
          <p>Here's your invoice for services rendered:</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Amount Due:</strong> $${(invoice.amount as number).toFixed(2)}</p>
            <p><strong>Due Date:</strong> ${new Date(invoice.dueDate as string).toLocaleDateString()}</p>
            <p><strong>Service:</strong> ${client.plan}</p>
          </div>
          <p>Please remit payment at your earliest convenience.</p>
          <p>Best,<br/>Kootenay Signal Team</p>
        </div>
      `,
      tags: [{ name: "type", value: "invoice" }],
    });

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data: {
        invoiceId: invoice.id,
        sentTo: client.email,
        amount: invoice.amount,
        client: client.name,
      },
    };
  },

  async list_unpaid_invoices(input) {
    let q = supabase
      .from("Invoice")
      .select("*, Client(name, email, business)")
      .in("status", ["pending", "overdue"])
      .order("dueDate", { ascending: true });

    if (input.clientId) q = q.eq("clientId", input.clientId as string);

    const { data: invoices } = await q;

    const shaped = (invoices || []).map((i: Record<string, unknown>) => {
      const { Client, ...rest } = i;
      return { ...rest, client: Client };
    });
    return { success: true, data: { invoices: shaped, count: shaped.length } };
  },

  // ═══════ ANALYTICS ═══════

  async get_campaign_metrics(input) {
    const { data: campaign } = await supabase
      .from("EmailCampaign")
      .select("*, CampaignMessage(status), CampaignContact(status), CampaignRun(status)")
      .eq("id", input.campaignId as string)
      .single();

    if (!campaign) return { success: false, error: "Campaign not found" };

    const messages = (campaign.CampaignMessage as Array<Record<string, string>>) || [];
    const contacts = (campaign.CampaignContact as Array<Record<string, string>>) || [];

    const msgStatuses = messages.reduce((acc: Record<string, number>, m) => {
      acc[m.status] = (acc[m.status] || 0) + 1;
      return acc;
    }, {});

    return {
      success: true,
      data: {
        name: campaign.name,
        status: campaign.status,
        totalMessages: messages.length,
        totalContacts: contacts.length,
        messageBreakdown: msgStatuses,
        contactStatuses: contacts.reduce((acc: Record<string, number>, c) => {
          acc[c.status] = (acc[c.status] || 0) + 1;
          return acc;
        }, {}),
      },
    };
  },

  async get_dashboard_stats() {
    const [leadsRes, clientsRes, contactsRes, invoicesRes, mailboxesRes, campaignsRes] = await Promise.all([
      supabase.from("Lead").select("*", { count: "exact", head: true }),
      supabase.from("Client").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("EmailContact").select("*", { count: "exact", head: true }),
      supabase.from("Invoice").select("amount").eq("status", "pending"),
      supabase.from("EmailAccount").select("warmupStatus, trustScore"),
      supabase.from("EmailCampaign").select("*", { count: "exact", head: true }).eq("status", "active"),
    ]);

    const invoices = invoicesRes.data || [];
    const mailboxes = mailboxesRes.data || [];

    return {
      success: true,
      data: {
        totalLeads: leadsRes.count || 0,
        activeClients: clientsRes.count || 0,
        totalContacts: contactsRes.count || 0,
        activeCampaigns: campaignsRes.count || 0,
        unpaidInvoices: invoices.length,
        unpaidAmount: invoices.reduce((sum: number, i: Record<string, number>) => sum + i.amount, 0),
        mailboxes: {
          total: mailboxes.length,
          warming: mailboxes.filter((m: Record<string, unknown>) => m.warmupStatus === "warming").length,
          stable: mailboxes.filter((m: Record<string, unknown>) => m.warmupStatus === "stable").length,
          atRisk: mailboxes.filter((m: Record<string, unknown>) => m.warmupStatus === "at_risk").length,
          avgTrustScore: mailboxes.length > 0
            ? mailboxes.reduce((sum: number, m: Record<string, unknown>) => sum + (m.trustScore as number), 0) / mailboxes.length
            : 0,
        },
      },
    };
  },
};
