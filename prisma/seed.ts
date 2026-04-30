import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // Create admin user
  const hashedPassword = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "jaryd@kootenaysignal.com" },
    update: {},
    create: {
      email: "jaryd@kootenaysignal.com",
      password: hashedPassword,
      name: "Jaryd",
      role: "admin",
    },
  });
  console.log(`✅ Admin user: ${admin.email}`);

  // ── Full service catalog ──
  const services = [
    // ── One-time setup (isOneOff: true) ──
    {
      name: "Website Build",
      description: "Professional website built and handed off. One-time setup — no ongoing management included.",
      price: 150,
      isOneOff: true,
      features: JSON.stringify([
        "Mobile-responsive design",
        "Up to 5 pages",
        "Contact form",
        "Google Analytics setup",
        "Handed off to client",
        "One-time setup · No ongoing management",
      ]),
    },
    {
      name: "Google Ranking Boost",
      description: "One-time SEO foundation setup. Keywords, meta titles & descriptions, H1/H2 structure, schema, image alt tags, internal linking.",
      price: 97,
      isOneOff: true,
      features: JSON.stringify([
        "Keyword insertion (service + city)",
        "Meta titles & descriptions",
        "H1/H2 structure optimization",
        "Local business schema markup",
        "Image alt tag optimization",
        "Internal linking setup",
        "One-time setup · No ongoing management",
      ]),
    },
    {
      name: "Missed Call Text Back",
      description: "Auto-SMS reply when a call is missed. Twilio/Zapier integration, missed call trigger, custom message template.",
      price: 147,
      isOneOff: true,
      features: JSON.stringify([
        "Twilio or similar setup",
        "Missed call trigger automation",
        "Custom SMS message template",
        "Zapier / webhook integration",
        "Testing & go-live",
        "One-time setup · No ongoing management",
      ]),
    },
    {
      name: "AI Quote Assistant",
      description: "Structured prompt system or mini tool for generating quotes and proposals. Inputs → outputs. One-time build.",
      price: 97,
      isOneOff: true,
      features: JSON.stringify([
        "Custom prompt engineering",
        "Quote/inquiry workflow",
        "Website embed or shareable link",
        "Testing & refinement",
        "Handoff documentation",
        "One-time setup · No ongoing management",
      ]),
    },
    {
      name: "Google Business Optimization",
      description: "Full GBP audit and optimization. Categories, description, service areas, keyword injection, posting template, review strategy.",
      price: 97,
      isOneOff: true,
      features: JSON.stringify([
        "Category optimization",
        "Business description rewrite",
        "Service area configuration",
        "Keyword injection",
        "Posting template",
        "Review strategy guide",
        "One-time setup · No ongoing management",
      ]),
    },
    // ── Monthly retainers (isOneOff: false) ──
    {
      name: "SEO Retainer",
      description: "Ongoing search visibility management. Backlinking, content strategy, ranking monitoring, technical SEO — fully managed monthly.",
      price: 997,
      isOneOff: false,
      features: JSON.stringify([
        "Ongoing backlink acquisition",
        "Monthly content strategy",
        "Keyword rank tracking",
        "Technical SEO audits",
        "Google Search Console monitoring",
        "Monthly reporting",
      ]),
    },
    {
      name: "Automation Management",
      description: "Ongoing automation and workflow management. New automations, monitoring, optimization — your systems always running.",
      price: 497,
      isOneOff: false,
      features: JSON.stringify([
        "Workflow monitoring & optimization",
        "New automation builds",
        "Missed call / lead response systems",
        "CRM integration maintenance",
        "Monthly review call",
      ]),
    },
    {
      name: "Ads Management",
      description: "Fully managed Google and Meta advertising. Campaign build, optimization, reporting, and scaling — all done for you.",
      price: 1000,
      isOneOff: false,
      features: JSON.stringify([
        "Google Ads campaign management",
        "Meta (Facebook/Instagram) ads",
        "Ad copy & creative direction",
        "Audience targeting & optimization",
        "Weekly performance reporting",
        "Monthly strategy review",
      ]),
    },
    {
      name: "SignalCore™",
      description: "Foundation retainer for regional search dominance. Google Business management, local citations, core SEO — all handled monthly.",
      price: 1500,
      isOneOff: false,
      features: JSON.stringify([
        "Google Business Profile management",
        "Local citation building",
        "Core SEO maintenance",
        "Monthly reporting",
        "Keyword tracking",
      ]),
    },
    {
      name: "SearchVault™",
      description: "Advanced search visibility retainer. Everything in SignalCore plus content strategy, backlink campaigns, and competitive analysis.",
      price: 2500,
      isOneOff: false,
      features: JSON.stringify([
        "Everything in SignalCore",
        "Content strategy & creation",
        "Backlink acquisition",
        "Competitive analysis",
        "Schema markup implementation",
        "Technical SEO audits",
      ]),
    },
    {
      name: "SearchSync™",
      description: "Full multi-platform sync retainer. Consistent presence across all search platforms, directories, review sites, and social.",
      price: 3000,
      isOneOff: false,
      features: JSON.stringify([
        "Everything in SearchVault",
        "Multi-platform sync",
        "Social media integration",
        "Review management",
        "Local ads management",
        "Priority support",
      ]),
    },
  ];

  for (const service of services) {
    await prisma.service.upsert({
      where: { name: service.name },
      update: service,
      create: service,
    });
  }
  console.log(`✅ ${services.length} services created`);

  // Create sample leads
  const leads = [
    { name: "Mike Thompson", email: "mike@nelsonplumbing.ca", phone: "250-555-0101", business: "Nelson Plumbing Co.", message: "Need help getting found in Nelson searches. Currently invisible online.", source: "website", status: "new" },
    { name: "Sarah Chen", email: "sarah@revelstokebakery.ca", phone: "250-555-0102", business: "Revelstoke Mountain Bakery", message: "Our competitors show up first on Google. We need to fix that.", source: "website", status: "contacted" },
    { name: "Dave Wilson", email: "dave@cranbrookauto.ca", phone: "250-555-0103", business: "Cranbrook Auto Service", message: "Looking for SEO and Google Business help.", source: "referral", status: "qualified" },
    { name: "Lisa Park", email: "lisa@invermereresort.ca", phone: "250-555-0104", business: "Invermere Lake Resort", message: "Want to dominate regional tourism searches.", source: "website", status: "new" },
    { name: "James Murray", email: "james@kimberleyelectrical.ca", phone: "250-555-0105", business: "Kimberley Electrical", message: "We need to show up on maps and search.", source: "cold-outreach", status: "contacted" },
  ];

  for (const lead of leads) {
    const existing = await prisma.lead.findFirst({ where: { email: lead.email } });
    if (!existing) {
      await prisma.lead.create({ data: lead });
    }
  }
  console.log(`✅ ${leads.length} sample leads created`);

  // Create sample clients
  const clients = [
    { name: "Tom Bradley", email: "tom@fernieskishop.ca", phone: "250-555-0201", business: "Fernie Ski & Board", website: "fernieskishop.ca", plan: "SearchVault", monthlyRate: 2500, status: "active" },
    { name: "Anna Kowalski", email: "anna@goldenrealtor.ca", phone: "250-555-0202", business: "Golden Real Estate", website: "goldenrealtor.ca", plan: "SearchSync", monthlyRate: 3000, status: "active" },
    { name: "Robert Fraser", email: "robert@castlegarbuilders.ca", phone: "250-555-0203", business: "Castlegar Custom Builds", website: "castlegarbuilders.ca", plan: "SignalCore", monthlyRate: 1500, status: "active" },
  ];

  for (const client of clients) {
    const existing = await prisma.client.findFirst({ where: { email: client.email } });
    if (!existing) {
      const createdClient = await prisma.client.create({ data: client });
      // Create a sample invoice for each client
      await prisma.invoice.create({
        data: {
          clientId: createdClient.id,
          amount: client.monthlyRate,
          status: "paid",
          dueDate: new Date("2026-04-01"),
          paidAt: new Date("2026-04-01"),
        },
      });
      await prisma.invoice.create({
        data: {
          clientId: createdClient.id,
          amount: client.monthlyRate,
          status: "pending",
          dueDate: new Date("2026-05-01"),
        },
      });
    }
  }
  console.log(`✅ ${clients.length} sample clients with invoices created`);

  console.log("\n🎉 Seed complete!");
  console.log("\n📧 Login: admin@kootenaysignal.com");
  console.log("🔑 Password: admin123\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
