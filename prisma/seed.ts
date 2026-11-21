// Demo data: `npm run db:seed`. Creates one organization with sample records.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

async function main() {
  if (await db.organization.findUnique({ where: { slug: "demo" } })) {
    console.log("Demo organization already exists. Delete prisma/dev.db and run `npm run db:reset` to start fresh.");
    return;
  }
  const pw = await bcrypt.hash("Admin@123", 10);
  const org = await db.organization.create({
    data: {
      name: "Demo Staffing Inc",
      slug: "demo",
      subscriptionStatus: "COMPLIMENTARY",
      email: "accounts@demo-staffing.test",
      phone: "(512) 555-0100",
      address: "100 Congress Ave",
      city: "Austin",
      state: "Texas",
      zip: "78701",
      departments: { create: [{ name: "General" }, { name: "Engineering" }, { name: "Finance" }, { name: "HR" }] },
      jobTitles: { create: [{ name: "Software Engineer" }, { name: "Senior Software Engineer" }, { name: "Business Analyst" }, { name: "QA Engineer" }] },
    },
    include: { jobTitles: true, departments: true },
  });
  const admin = await db.user.create({
    data: { organizationId: org.id, email: "admin@demo.test", name: "Demo Admin", role: "ADMIN", passwordHash: pw, mustChangePassword: false },
  });

  const [axiom, northwind] = await Promise.all([
    db.client.create({
      data: {
        organizationId: org.id, clientCode: "CL-0001", name: "Axiom Global Technologies", billingEmail: "ap@axiom.test",
        billingContactName: "Priya Shah", approverName: "Mark Lee", approverEmail: "mark@axiom.test", paymentTermsDays: 30,
        invoiceFrequency: "MONTHLY", city: "Dallas", state: "Texas",
      },
    }),
    db.client.create({
      data: {
        organizationId: org.id, clientCode: "CL-0002", name: "Northwind Health", billingEmail: "billing@northwind.test",
        billingContactName: "Sam Carter", paymentTermsDays: 45, invoiceFrequency: "MONTHLY", city: "Houston", state: "Texas",
      },
    }),
  ]);

  await db.user.create({
    data: {
      organizationId: org.id, clientId: axiom.id, role: "CLIENT", email: "mark@axiom.test", name: "Mark Lee",
      jobTitle: "Engineering Manager", passwordHash: await bcrypt.hash("Client@123", 10), mustChangePassword: false,
    },
  });
  const jt = (n: string) => org.jobTitles.find((j) => j.name === n)!.id;
  const eng = org.departments.find((d) => d.name === "Engineering")!.id;
  const people = [
    { firstName: "Ratna", lastName: "Prasanna", email: "ratna@demo.test", title: "Senior Software Engineer", client: axiom, bill: 9500, pay: 7000 },
    { firstName: "Anjaneyulu", lastName: "Reddy", email: "anji@demo.test", title: "Software Engineer", client: axiom, bill: 8000, pay: 6000 },
    { firstName: "Mohammad", lastName: "Khan", email: "mohammad@demo.test", title: "QA Engineer", client: northwind, bill: 6500, pay: 4800 },
    { firstName: "Vamsi", lastName: "Mohan", email: "vamsi@demo.test", title: "Business Analyst", client: northwind, bill: 7500, pay: 5500 },
  ];
  const now = new Date();
  const thisMonth = utc(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const months = [-3, -2, -1].map((k) => {
    const s = new Date(Date.UTC(thisMonth.getUTCFullYear(), thisMonth.getUTCMonth() + k, 1));
    const e = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 0));
    return { s, e };
  });

  let n = 1;
  const tsByMonth: Record<number, { id: string; clientId: string; minutes: number; bill: number; name: string; s: Date; e: Date }[]> = { 0: [], 1: [], 2: [] };
  for (const p of people) {
    const user = await db.user.create({
      data: { organizationId: org.id, email: p.email, name: `${p.firstName} ${p.lastName}`, role: "EMPLOYEE", passwordHash: await bcrypt.hash("Employee@123", 10), mustChangePassword: false },
    });
    const emp = await db.employee.create({
      data: {
        organizationId: org.id, userId: user.id, employeeCode: `EMP-${String(n++).padStart(4, "0")}`,
        firstName: p.firstName, lastName: p.lastName, email: p.email, jobTitleId: jt(p.title), departmentId: eng,
        employmentType: "W2", dateOfJoining: months[0].s, state: "Texas", workAuthorization: "H1B", defaultPayRate: p.pay,
      },
    });
    const placement = await db.placement.create({
      data: {
        organizationId: org.id, employeeId: emp.id, clientId: p.client.id, startDate: months[0].s,
        timesheetFrequency: "MONTHLY", billRate: p.bill, payRate: p.pay, projectName: "Platform modernization",
      },
    });
    for (let i = 0; i < 3; i++) {
      const { s, e } = months[i];
      const entries = [];
      for (let t = s.getTime(); t <= e.getTime(); t += 86400000) {
        const d = new Date(t);
        if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) entries.push({ workDate: d, regularMinutes: 480, overtimeMinutes: 0 });
      }
      const minutes = entries.length * 480;
      const status = i < 2 ? "APPROVED" : p.firstName === "Vamsi" ? "SUBMITTED" : "APPROVED";
      const ts = await db.timesheet.create({
        data: {
          organizationId: org.id, employeeId: emp.id, placementId: placement.id, periodStart: s, periodEnd: e, status,
          totalMinutes: minutes, regularMinutes: minutes, billableMinutes: minutes, submittedAt: addDays(e, 3),
          reviewedAt: status === "APPROVED" ? addDays(e, 5) : null, reviewedById: status === "APPROVED" ? admin.id : null,
          entries: { create: entries },
        },
      });
      if (status === "APPROVED") tsByMonth[i].push({ id: ts.id, clientId: p.client.id, minutes, bill: p.bill, name: `${p.firstName} ${p.lastName}`, s, e });
    }
  }

  // Invoices for the two oldest months; Axiom pays month 1 fully, Northwind is overdue.
  let invNo = 1001;
  for (const i of [0, 1]) {
    for (const client of [axiom, northwind]) {
      const sheets = tsByMonth[i].filter((t) => t.clientId === client.id);
      if (!sheets.length) continue;
      const lines = sheets.map((t) => ({
        description: `${t.name} - ${t.s.toISOString().slice(0, 10)} to ${t.e.toISOString().slice(0, 10)}`,
        minutes: t.minutes, rate: t.bill, amount: Math.round((t.minutes * t.bill) / 60), timesheetId: t.id,
      }));
      const total = lines.reduce((a, l) => a + l.amount, 0);
      const issueDate = addDays(months[i].e, 5);
      const paid = client.id === axiom.id && i === 0;
      const inv = await db.invoice.create({
        data: {
          organizationId: org.id, clientId: client.id, invoiceNumber: `INV-${invNo++}`, issueDate,
          dueDate: addDays(issueDate, client.paymentTermsDays), periodStart: months[i].s, periodEnd: months[i].e,
          subtotal: total, total, amountPaid: paid ? total : 0, status: paid ? "PAID" : "SENT", sentAt: issueDate,
          lines: { create: lines },
        },
      });
      await db.timesheet.updateMany({ where: { id: { in: sheets.map((s) => s.id) } }, data: { invoiceId: inv.id } });
      if (paid) {
        await db.payment.create({
          data: { organizationId: org.id, invoiceId: inv.id, clientId: client.id, amount: total, paidOn: addDays(issueDate, 25), method: "ACH", reference: "ACH-778812", recordedById: admin.id },
        });
      }
    }
  }
  await db.organization.update({ where: { id: org.id }, data: { nextInvoiceNo: invNo } });
  console.log("Seeded demo organization.");
  console.log("  Admin:    admin@demo.test / Admin@123");
  console.log("  Employee: ratna@demo.test / Employee@123");
  console.log("  Client:   mark@axiom.test / Client@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
