# PM2 guide for IPI Employees API

PM2 runs only the Express API. Nginx continues to serve the built Vue frontend
from `frontend/dist` and proxies `/api/` to `127.0.0.1:3003`.

## 1. Prepare the application

Install Node.js 20.19 or newer, then install the project dependencies and build
the frontend:

```bash
cd /var/www/ipiemp/backend
npm ci --omit=dev

cd ../frontend
npm ci
npm run build
```

For a Windows installation at `D:/ipiemp`, run the equivalent commands from
PowerShell:

```powershell
Set-Location D:\ipiemp\backend
npm ci --omit=dev

Set-Location D:\ipiemp\frontend
npm ci
npm run build
```

Create `backend/.env` from `backend/.env.example`. Keep database credentials
and `JWT_SECRET` in that file, not in `ecosystem.config.js`. Production must
contain these values:

```dotenv
HOST=127.0.0.1
PORT=3003
NODE_ENV=production
FRONTEND_ORIGIN=https://ibnsina.shadiqur.bd
```

The ecosystem file sets the same non-secret runtime values as a safeguard.
Because its `cwd` is the `backend` directory, the application's existing
`dotenv/config` import loads `backend/.env` correctly.

## 2. Install PM2 and start the API

Install PM2 globally once:

```bash
npm install pm2@latest -g
```

Start the ecosystem from the repository root:

```bash
cd /var/www/ipiemp
pm2 start ecosystem.config.js --env production
pm2 save
```

On Windows, use:

```powershell
Set-Location D:\ipiemp
pm2 start ecosystem.config.js --env production
pm2 save
```

Expected process name: `ipi-employees-api`. It runs one fork-mode instance on
`127.0.0.1:3003`; port 3003 must remain internal and should not be opened in
the public firewall.

## 3. Start automatically after reboot

### Linux VPS

Run PM2 as the normal deployment user, not as root:

```bash
pm2 startup
```

PM2 prints one platform-specific command beginning with `sudo`. Run that exact
printed command, then save the current process list:

```bash
pm2 save
```

Test it with a controlled reboot when appropriate, then check `pm2 status`.

### Windows physical server

PM2's built-in `pm2 startup` generator does not support Windows services. The
official PM2 startup documentation points Windows users to `pm2-installer`.
Install/configure that helper under the same Windows account that owns the PM2
process list, or use Windows Task Scheduler to run this command at system
startup under that account:

```powershell
pm2 resurrect
```

For Task Scheduler, first run `(Get-Command pm2).Source` in PowerShell and use
that absolute `pm2.cmd` path in the task. Set the task to run whether the user
is logged on or not, with `D:\ipiemp` as its **Start in** directory. If Task
Scheduler cannot execute a `.cmd` file directly, run `cmd.exe` with arguments
`/c "ABSOLUTE_PATH_TO_PM2.CMD resurrect"`.

Run `pm2 save` again whenever the managed process list changes. Do not mix an
Administrator-owned PM2 daemon with a standard-user-owned daemon; each Windows
account has a separate PM2 home and saved process list.

## 4. Verify and operate

Linux health check:

```bash
curl http://127.0.0.1:3003/health
```

Windows health check:

```powershell
Invoke-RestMethod http://127.0.0.1:3003/health
```

The response should be `{ "ok": true }`. Useful commands:

```bash
pm2 status
pm2 describe ipi-employees-api
pm2 logs ipi-employees-api --lines 100
pm2 monit
pm2 restart ipi-employees-api
pm2 stop ipi-employees-api
```

## 5. Deploy an application update

From the new repository version:

```bash
cd backend
npm ci --omit=dev

cd ../frontend
npm ci
npm run build

cd ..
pm2 startOrRestart ecosystem.config.js --env production
pm2 save
```

If PM2-managed environment variables changed, use:

```bash
pm2 restart ipi-employees-api --update-env
pm2 save
```

Rebuilding the frontend does not require a PM2 restart because Nginx serves
the generated static files directly.
