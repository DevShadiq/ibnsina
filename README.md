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

The API root contains `app.js`, which exports the Express application for
Vercel's zero-configuration Express runtime. Do not set a backend build command
or output directory. The web project should use the Vite framework preset,
`npm run build`, and the default `dist` output directory.

Redeploy each project whenever its environment variables change. Do not use
`localhost` in a Vercel environment variable. `FRONTEND_ORIGIN` must be the
exact frontend origin. A trailing slash is accepted, but this is the preferred
form: `https://YOUR-FRONTEND.vercel.app`.

Use the pooled Neon hostname (it contains `-pooler`) and retain
`sslmode=require` in the connection URL. The backend also accepts
`POSTGRES_URL` when the Vercel Neon integration supplies that name. Add the
database and authentication variables to Preview as well as Production if you
want backend preview deployments to start successfully.

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

## Existing PostgreSQL database

The main schema already includes per-employee education numbering,
batch-scoped employee identity, Admin/Super Admin roles, public drafts, approval
states, update requests, and child information. If the Neon database was made
from an earlier version of this PostgreSQL schema that does not have
`hr_empfamilydet`, run `database/migration_add_employee_children.sql` once. The
migration is also safe when the table already exists and adds the stable
`family_id` used by the current API.

New command-line accounts default to Super Admin; an explicit role can be
supplied as the final argument:

```bash
npm run admin:create -- username password "Display Name" ADMIN
npm run admin:create -- username password "Display Name" SUPER_ADMIN
```
