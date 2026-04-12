import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // Create admin user
  const hashedPassword = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@kootenaysignal.com" },
    update: {},
    create: {
      email: "admin@kootenaysignal.com",
      password: hashedPassword,
      name: "Admin",
      role: "admin",
    },
  });
  console.log(`✅ Admin user: ${admin.email}`);

  // Create services matching the site
  const services = [
    {
      name: "SignalCore™",
      description: "Foundation package for regional search dominance. Includes Google Business optimization, local citations, and core SEO setup.",
      price: 1500,
      features: JSON.stringify([
        "Google Business Profile optimization",
        "Local citation building",
        "Core SEO foundation",
        "Monthly reporting",
        "Keyword tracking",
      ]),
    },
    {
      name: "SearchVault™",
      description: "Advanced search visibility package. Builds on SignalCore with content strategy, backlink campaigns, and competitive analysis.",
      price: 2500,
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
      name: "SmartNav™",
      description: "Intelligent navigation and UX optimization. Conversion-focused website improvements with A/B testing.",
      price: 2000,
      features: JSON.stringify([
        "UX audit & recommendations",
        "Conversion rate optimization",
        "A/B testing",
        "Navigation restructuring",
        "Mobile optimization",
      ]),
    },
    {
      name: "SearchSync™",
      description: "Full multi-platform synchronization. Ensures consistent presence across all search platforms and directories.",
      price: 3000,
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
