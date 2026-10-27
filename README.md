# sameulshajid.art

A digital graphic-design store and custom-work portal built with Django REST Framework and Angular.

## Current foundation

- Custom email-based user model with `CUSTOMER` and `DESIGNER` roles
- JWT registration, sign-in, token refresh, and current-user API
- API health check and generated OpenAPI schema
- Angular 22 storefront shell with home, shop, sign-in, and registration routes
- PostgreSQL-ready configuration with SQLite as the no-setup development default

## Run locally

### One-click start on Windows

Double-click `run.cmd` in the project folder. It stops servers opened by the previous launcher run, prepares missing dependencies, applies migrations, starts fresh development servers, and opens the storefront in your browser.

The launcher also adds the demo catalog on a new/empty database. Existing catalog data is never overwritten.

### Backend (PowerShell)

```powershell
Copy-Item .env.example .env
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
python backend\manage.py migrate
python backend\manage.py createsuperuser
python backend\manage.py runserver
```

API: http://localhost:8000/api/  
API documentation: http://localhost:8000/api/docs/

### Frontend

```powershell
Set-Location frontend
npm install
npm start
```

The frontend pins its required Node 22 runtime locally, so the npm scripts remain reproducible even when the machine-wide Node version is older.

Storefront: http://localhost:4200

## Verification

```powershell
.\.venv\Scripts\python.exe backend\manage.py test accounts core
Set-Location frontend
npm test -- --watch=false
npm run build
```

See [docs/FOUNDATION.md](docs/FOUNDATION.md) for decisions, architecture, and the initial API contract.

