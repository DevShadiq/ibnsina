# Employee Portal V5 — Merit List + Class ID + Phone Verification

## New employee identity workflow

IPI is no longer required when the employee first submits data.

Employee begins with:

- MERITLIST_ID
- CLASS_ID
- PHONE

If no existing record exists for the Merit List ID + Class ID and an ACTIVE batch exists, the employee can submit data.

The server stores an internal primary key:

```text
EMP_ENTRY_ID
```

Admin later assigns IPI.

## Admin IPI assignment

Admin panel:

```text
/admin
```

Employee List shows:

- Merit List ID
- Class ID
- IPI
- Name
- Phone
- Batch

Admin clicks:

```text
Assign IPI
```

The API updates both:

```text
UP_EMP.IPI
HR_EMPEXAMDET.EMPCODE
```

inside one database transaction.

## Employee verification for edit

Existing employee must provide all three correctly:

```text
MERITLIST_ID
CLASS_ID
PHONE
```

The server checks:

```sql
WHERE MERITLIST_ID = ?
  AND CLASS_ID = ?
  AND PHONE = ?
```

If Merit List ID + Class ID exist but phone does not match, access is denied.

## Batch rules remain

Normal update:

```text
Employee's batch = ACTIVE
        ↓
MERITLIST_ID + CLASS_ID + PHONE verified
        ↓
EDIT ALLOWED
```

Inactive batch:

```text
Verified employee
        ↓
VIEW ONLY
        ↓
Request Update Access
        ↓
Admin Approves
        ↓
24-hour update window
```

## Why EMP_ENTRY_ID is required

Before admin assigns IPI, education rows still need a reliable relation.

Therefore:

```text
UP_EMP.EMP_ENTRY_ID
        │
        └── HR_EMPEXAMDET.EMP_ENTRY_ID
```

IPI is nullable initially:

```text
UP_EMP.IPI = NULL
```

After admin assignment:

```text
UP_EMP.IPI = IPI000123
HR_EMPEXAMDET.EMPCODE = IPI000123
```

## PostgreSQL important indexes

```text
UNIQUE (batch_no, MERITLIST_ID, CLASS_ID)
UNIQUE (IPI)
INDEX  (MERITLIST_ID, CLASS_ID, PHONE)
```

## Production security

Merit List ID + Class ID + Phone is much better than IPI-only lookup, but for highly sensitive employee data you should still consider OTP verification later.

Recommended final authentication:

```text
Merit List ID
+ Class ID
+ Phone
+ OTP
```

## Run locally

Install dependencies once:

```bash
cd backend && npm install
cd ../frontend && npm install
```

Create `backend/.env` from `backend/.env.example` and set `DATABASE_URL` to the
pooled connection string from your Neon project.

Start the API in one terminal:

```bash
cd backend
npm run dev
```

Start the frontend in a second terminal:

```bash
cd frontend
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). The Vite dev
server proxies `/api` requests to `http://localhost:3003`, so no frontend API
environment variable is required for local development.

## Deploy to Vercel with Neon PostgreSQL

Deploy two Vercel projects from this repository:

| Project | Root directory | Required production variables |
| --- | --- | --- |
| API | `backend` | `NODE_ENV=production`, `DATABASE_URL` (pooled Neon URL), `DB_POOL_MAX=3`, `JWT_SECRET`, `FRONTEND_ORIGIN=https://YOUR-FRONTEND.vercel.app` |
| Web | `frontend` | `VITE_API_URL=https://YOUR-BACKEND.vercel.app/api` |

Redeploy each project whenever its environment variables change. Do not use
`localhost` in a Vercel environment variable. `FRONTEND_ORIGIN` must be the
exact frontend origin. A trailing slash is accepted, but this is the preferred
form: `https://YOUR-FRONTEND.vercel.app`.

Use the pooled Neon hostname (it contains `-pooler`) and retain
`sslmode=require` in the connection URL. The backend also accepts
`POSTGRES_URL` when the Vercel Neon integration supplies that name.

To create the initial admin against the production database, download the API
project's Vercel Production variables locally, run the command below from
`backend`, then remove the downloaded `.env` file:

```bash
npx vercel env pull .env --environment=production
npm run admin:create -- admin "use-a-strong-password" "Administrator"
```

## Migration note

The database schema is PostgreSQL/Neon compatible and differs from the earlier
MySQL version.

For a new/test database, simply run:

Paste `database/employee_portal.sql` into the Neon SQL Editor and run it, or use:

```bash
psql "$DATABASE_URL" -f database/employee_portal.sql
```

After setting `backend/.env`, verify the backend connection with:

```bash
cd backend
npm run db:check
```

The supplied SQL file drops and recreates the application tables before loading
the included seed data. Do not run it against a Neon database containing newer
production data without a backup.

## Deploy to a physical server or VPS

This repository serves both the public site and the admin pages from one Vue
build. The production frontend directory is `frontend/dist`, and the Express
API listens on port `3003` by default. Do not use `dist/admin` or port `5001`
from a different project's Nginx configuration.

Install and build the application:

```bash
cd backend
npm ci --omit=dev

cd ../frontend
npm ci
npm run build
```

Copy `backend/.env.example` to `backend/.env`, then set the production values.
For Nginx running on the same machine, use at least:

```dotenv
HOST=127.0.0.1
PORT=3003
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DATABASE?sslmode=require
DB_POOL_MAX=10
JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
FRONTEND_ORIGIN=https://ibnsina.shadiqur.bd
```

Import `database/employee_portal.sql` only for a new database or when you
intentionally want to replace all application tables and load its seed data.

Use the matching deployment files:

- Windows physical server: `deploy/nginx/windows/ibnsina.shadiqur.bd.conf`
- Linux VPS: `deploy/nginx/linux/ibnsina.shadiqur.bd.conf` and
  `deploy/systemd/ipi-employees.service`
- PM2 on Windows or Linux: `ecosystem.config.js` and `PM2.md`

On Windows, start the backend from `D:/ipiemp/backend` with `npm start` and
register that command with your preferred Windows service manager so it starts
after reboot. Put the Windows server block inside the `http { ... }` section of
`C:/nginx/conf/nginx.conf`, or include it from there. Validate and reload it
from an Administrator terminal:

```powershell
C:\nginx\nginx.exe -t
C:\nginx\nginx.exe -s reload
```

On Linux, make the deployed files readable by the service account, copy the
systemd unit to
`/etc/systemd/system/ipi-employees.service`, then run:

```bash
sudo chown -R www-data:www-data /var/www/ipiemp
sudo systemctl daemon-reload
sudo systemctl enable --now ipi-employees
sudo systemctl status ipi-employees
```

After installing the appropriate Nginx file, validate and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Verify the deployment with `https://ibnsina.shadiqur.bd`,
`https://ibnsina.shadiqur.bd/admin`, and
`https://ibnsina.shadiqur.bd/health`.

## Existing database: education row numbering

Education `SLNO` is numbered separately for each employee: every employee's
first education row is `1`, then `2`, `3`, and so on. For an existing
database, run `database/migration_per_employee_education_slno.sql` once before
deploying this change.

## Existing database: batch-scoped employee identity

Merit List ID and Class ID are unique together within a batch. The same pair
may be reused in a different batch. For an existing database, run
`database/migration_batch_employee_identity.sql` once before deploying the
matching backend.

## Existing database: Admin and Super Admin user types

Super Admin accounts can create, edit, activate/deactivate, reset passwords,
and delete administrator accounts. They can also rename batches, change their
status, permanently delete empty batches, and delete employee records. Admin
accounts retain employee, batch, approval,
request, and export access but cannot manage other users or perform permanent
deletes. Every logged-in Admin or Super Admin can change their own password by
confirming their current password.

For an existing database, run
`database/migration_add_admin_user_types.sql` once before deploying this change.
The migration promotes existing administrator accounts to Super Admin so user
management remains accessible. New command-line accounts default to Super Admin;
an explicit type can be supplied as the final argument:

```bash
npm run admin:create -- username password "Display Name" ADMIN
npm run admin:create -- username password "Display Name" SUPER_ADMIN
```

## Existing database: public draft saving

New-employee forms can be saved as incomplete drafts and submitted later.
For an existing database, run `database/migration_allow_employee_drafts.sql`
once before deploying the matching backend.
