# AGENTS.md

## Project overview

InQRess is a single-admin QR ticketing and check-in system.

- Backend: FastAPI in `backend/src/`
- Frontend: React + Vite, built into the same Docker image
- Release image: `Dockerfile`
- Dev environment: same image via `dev-compose.yaml` + Compose Watch
- Auth: HttpOnly session cookie (`__Host-inqress_session` when `cookie_secure: true`)
- Config: `backend/src/config.py` (pydantic models) + YAML loaded via `CONFIG_PATH`

## Development server

Before starting work, check if a dev server is already running:

```bash
docker compose -f dev-compose.yaml ps
```

If `inqress-inqress-1` is up and healthy, use it. Do not start a second stack.

If it is not running:

```bash
docker compose -f dev-compose.yaml watch
```

- Backend source changes under `backend/src/` are synced and restart the container.
- Frontend, `pyproject.toml`, `uv.lock`, or `Dockerfile` changes trigger a cached rebuild.
- UI is available at `http://localhost:7000`.
- Logs: `docker compose -f dev-compose.yaml logs --tail 80`

### Logging into the dev instance

The Chrome browser with remote debugging is available. Use it to access `http://localhost:7000` and perform operation freely.

If a login form is presented, read credentials from the committed file `local_dev/config.yaml`, fill the username and password fields, then submit the form.

> Note: Only perform a full-stack browser inspection when the user specifically requested it. For usual implementation, just perform linting and formatting

## Linting and formatting (must pass CI)

Run these commands from the respective directories. Fix all issues before committing.

### Frontend (`frontend/`)

```bash
npm run format          # write
npm run format:check    # CI check
npm run lint            # eslint
npx tsc -b              # type check
```

### Backend (`backend/`)

```bash
uv run ruff format src/           # write
uv run ruff format --check src/   # CI check
uv run ruff check src/            # lint
uv run mypy src/                  # type check
```

CI runs the check variants only. The write commands are how you reach a clean state.

## Consistency rules

These relationships must be kept in sync. Breaking any of them causes runtime or startup failures.

### Config
- New required fields must be added in `backend/src/config.py`
- The same fields must be emitted by `install.sh:generate_config()`
- `local_dev/config.yaml` must contain the new keys (or rely on pydantic defaults)
- YAML uses snake_case. `install.sh` writes to `~/.inqress/config.yaml`. Dev compose mounts `local_dev/config.yaml` at `/app/config.yaml` and sets `CONFIG_PATH`.

### Database schema
- `backend/src/schema/orm.py` must match the live tables and the chain of alembic revisions that live in `backend/src/alembic/versions/`.
- Never autogenerate from a drifted model.

### Auth
- Streams and authenticated routes use the session cookie only.
- No `Authorization: Basic` and no `?token=` query parameter on any endpoint.

### Frontend ↔ Backend
- REST response shapes in `backend/src/schema/rest.py` (camelCase) must match what `frontend/src/api.ts` and the generated hooks expect.
- Any change to a response model requires corresponding frontend updates.

### Frontend

- Use native MUI components to achieve UI functionalities if it is already supported, following the conventional usage and layout illustrated in official MUI documentation (use `mui-mcp` to read it)
- Rely on native components props for styling. Only use inline `sx` if certain functionalities is not already natively supported.

## Never

- Do not put real secrets, passwords, or API keys in this file or any committed file. (Exception being `NeverGonnaGiveYouUp` and `NeverGonnaLetYouDown`, which are admin credentials used for the reusable local dev server)
- Do not create a second Dockerfile for development.
- Do not mount or copy `local_dev/` into the release image.
- Do not set `trusted_proxies: ["0.0.0.0/0"]`.
- Do not introduce a second Alembic head.
- Do not re-introduce query-token or Basic auth on streams.
- Do not edit generated files or compiled output (`frontend/dist`, `.venv`, etc.).

## Additional notes

- SSE connections are intentionally left open after logout for the simplicity of application logic (they only close on browser refresh or network error).
- `server.api_docs: false` by default. Only enable it in `local_dev/config.yaml`.
- `cookie_secure: true` is required for production behind a TLS-terminating proxy.