# ReconcileIQ — Data Reconciliation Workspace

An enterprise-style reconciliation workspace for comparing CSV, TXT, XLSX, and
XLS datasets using one or more key columns. The React dashboard provides
upload/preview, configurable matching, exception analytics, filtered results,
and XLSX/CSV/JSON/PDF exports.

## Start both services on Windows

```powershell
python -m venv backend\venv
npm.cmd install
backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Copy-Item .env.example .env
```

Then run the frontend and backend together:

```powershell
npm.cmd run dev
```

Open `http://127.0.0.1:5173`. The API is available at `http://127.0.0.1:8000`
and its interactive OpenAPI docs at `http://127.0.0.1:8000/docs`.

To start either service separately, use `npm.cmd run dev:frontend` or
`npm.cmd run dev:backend`.

Run focused backend checks with
`backend\venv\Scripts\python.exe -m unittest backend.tests.test_comparison -v`.
Configure the frontend API origin and allowed CORS origins in `.env` before
deploying to a different host.

QA planning workbooks are included at the project root:
`ReconcileIQ_Test_Scenarios.xlsx` and `ReconcileIQ_Expanded_Test_Scenarios.xlsx`.
Their execution-result and screenshot columns should be completed by testers
during test execution.

## Project layout

- `frontend/components`, `frontend/pages`, `frontend/services`, and `frontend/src`
  contain the React dashboard, reusable UI, and API client.
- `backend/api`, `backend/services`, `backend/models`, `backend/reports`, and
  `backend/utils` separate endpoints, comparison logic, schemas, exports, and
  file parsing.

## API

- `POST /api/preview` — multipart `file`; returns columns, row count, metadata,
  and the first ten rows.
- `POST /api/compare` — multipart `source`, `target`, JSON `primary_keys`, and
  boolean comparison options.
- `GET /api/comparisons/{id}/results` — paginated and filterable differences.
- `GET /api/comparisons/{id}/preview/{source|target}` — paginated preview rows.
- `GET /api/comparisons/{id}/report/{xlsx|csv|json|pdf}` — download a report.

The upload endpoint limits files to 100 MB. Comparison results and preview data
are held in process memory for up to 30 minutes, with at most three active runs.
For multi-worker or durable production deployment, replace this bounded
development store with shared database/object storage and add organization
authentication, authorization, and background jobs.
