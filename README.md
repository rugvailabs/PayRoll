# PayFlow — Timesheets, Payroll & Client Billing

Multi-tenant web app for staffing / consulting companies: onboard employees, assign them to
clients, collect client-approved timesheets, invoice clients, track pending payment aging,
run payroll and send payment alerts.

**Stack:** Next.js 15 (App Router, server actions) · TypeScript · Prisma · Tailwind CSS 4 ·
SQLite for local dev (PostgreSQL for production) · nodemailer · pdf-lib.

## Run locally

```bash
npm install
npm run db:push      # create the database from prisma/schema.prisma
npm run db:seed      # optional demo data
npm run dev          # http://localhost:3000
```

Demo logins (after seeding): `admin@demo.test / Admin@123`, `ratna@demo.test / Employee@123`
(company code `demo`). Or click **Create an account** to set up a new organization.

## Main flow

1. **Clients → Add client**: billing email, CC, payment terms (Net 30…), approver, reminder toggle.
2. **Employees → Add employee**: full profile, optional assignment to a client with bill/pay rates,
   and a portal login. Credentials go out as a secure set-password link (default) or a temporary
   password, either emailed or shown once for the admin to share manually. Resend or reset any time
   from the employee profile.
3. **Employee portal → Submit timesheet**: daily regular/OT hours plus the client-approved timesheet
   file (required). Admins can also enter timesheets for employees.
4. **Timesheets**: approve or reject (with reason), individually or in bulk. Includes a "Missing" tab.
5. **Invoices**: pick approved timesheets, generate the invoice (bill rate × hours, OT at 1.5× unless
   set), email the PDF to the client.
6. **Payments & Aging**: outstanding by client in 0/1–30/31–60/61–90/90+ day buckets, and the list of
   clients who have not paid for more than N days (default 30). Record full/partial payments.
7. **Payroll**: build a run from approved timesheets (pay rate × hours), adjust, approve, mark paid —
   each employee gets a pay statement PDF by email.

## Alerts & notifications

| Event | Who |
|---|---|
| Account created / invite / temp password | Employee (email) |
| Timesheet due (last period missing) | Employee (email + in-app) |
| Timesheet submitted | Admins/managers (in-app) |
| Timesheet approved / rejected | Employee (email + in-app) |
| Invoice sent (PDF attached) | Client billing email + CC |
| Payment reminder before / on / after due date | Client (email); admins in-app when overdue |
| Daily overdue summary | Admins/accountants (email) |
| Payment received | Admins (in-app), receipt to client (optional) |
| Payroll paid (pay statement attached) | Employee (email + in-app) |

Reminder schedule is set per organization in **Settings** (default `-3,0,1,7,15,30` days relative to
the due date). Each reminder is sent once; invoices can be put **on hold** to pause reminders.

Reminders run hourly inside the server process. For multi-server / serverless hosting set
`REMINDERS_AUTORUN=false` and call the endpoint daily from a scheduler:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/reminders
```

## Email

Without SMTP settings, emails are **logged** to *Email Outbox* (viewable in the app) instead of being
delivered. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` in `.env` to send.

## Roles

| Role | Access |
|---|---|
| Admin | Everything incl. settings |
| Manager | Employees, clients, placements, timesheet approval |
| Accountant | Invoices, payments/aging, payroll (read-only people data) |
| Employee | Own timesheets, pay statements, profile |

## Multi-tenancy

Each organization (tenant) is isolated by `organizationId` on every record; every query and server
action scopes by the signed-in user's organization. Login is by email + password, with an optional
company code if one email belongs to several organizations.

## Production checklist

- Switch `provider` in `prisma/schema.prisma` to `postgresql` and set `DATABASE_URL`.
- Set a long random `AUTH_SECRET`, `APP_URL`, SMTP settings and `CRON_SECRET`.
- Replace local `uploads/` storage in `src/lib/files.ts` with S3 / Azure Blob.
- Payroll computes **gross pay only**; taxes/withholdings are handled by your payroll provider.
- Only the last 4 digits of SSN and bank account numbers are stored.

## Project layout

```
prisma/schema.prisma        data model (orgs, users, employees, clients, placements,
                            timesheets, invoices, payments, payroll, notifications, emails)
src/lib/                    auth, email, pdf, invoicing, payroll, reminders, formatting
src/app/(auth)/             login, signup, set/change password
src/app/(app)/              employees, clients, placements, timesheets, invoices,
                            receivables (aging), payroll, my/*, settings, emails
src/app/api/                PDFs, attachment downloads, cron endpoint
```
