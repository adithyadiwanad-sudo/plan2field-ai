# Windows setup notes

## Host inspected

Node 24.14.0, npm 11.9.0 and Python 3.13.9 were available. Docker Desktop, PostgreSQL/psql, WSL, FFmpeg and Tesseract were not available. Edge was available for headless layout tests. No OS feature, public deployment or paid service was configured.

Install/start Docker Desktop using its Linux engine before the README Compose workflow. WSL installation may require administrator access and a reboot; this prototype does not change those system settings automatically. Docker Desktop installation/first startup is a remaining user-machine prerequisite.

## Environment

Copy `.env.example` to `.env`; choose private local passwords. API and worker passwords are supplied to PostgreSQL through PG environment variables, avoiding URI-encoding issues in Compose. The owner password is used only in explicit setup/seed/test steps. Never put these values in frontend files.

Bootstrap scripts use Compose v2. Fresh-volume schema initialization runs once. Do not repeatedly apply the initial schema to an existing volume. Stop via `docker compose down` to retain database, upload and model volumes.

## Local source development

Use the Node/Python commands in README. A local backend outside Docker needs `DATABASE_URL` pointing to the restricted API role and `APP_ORIGIN` matching the Vite origin, e.g. `http://localhost:5173`. Set `UPLOAD_DIR` to a shared directory if a host worker is used. The worker also accepts libpq PGHOST/PGUSER/PGPASSWORD/PGDATABASE variables.

The frontend development server proxies `/api` to port 3001. `npm --prefix frontend run dev` serves port 5173. `npm --prefix backend run dev` serves port 3001. `.env` is not automatically loaded by these development commands; set shell environment variables or use Node's `--env-file` option. Docker loads `.env` through Compose.

The production preview at port 4173 is useful for isolated UI checks; it is not the same-origin Nginx stack and does not supply the backend by itself.

## Models

`download_models.py` is the explicit network step. `--semantic-only` downloads the two matching models; omitting it also downloads Whisper base. Normal worker inference loads only local files. Changing model revisions requires a matching manifest and re-embedding schedules.

Linux/Python 3.12 dependencies are in `requirements.lock`; Windows development resolves `requirements.in` with CPU Torch as documented. The Linux image/lock has not been built on this machine because Docker is unavailable. CPU memory and download allowances in README are planning estimates, not measured capacity guarantees.
