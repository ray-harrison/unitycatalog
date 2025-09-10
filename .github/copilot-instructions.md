# Copilot Repository Instructions — Unity C## Quick prom## Quick prompts
- *Discover bootstrap path*: "Trace process start → config → token file → principal → OWNER binding; cite files:lines; summarize risks & migration."
- *Add OWNER bootstrap endpoint*: "Draft additive `POST /api/2.1/unity-catalog/admins/bootstrap-owner` (preview) with conflict/forbidden semantics and examples."
- *PAT endpoints*: "Draft additive tokens endpoints under `/api/2.1/unity-catalog/tokens` with write‑once token value and hashed storage."
- *UI slice*: "Scaffold AdminBootstrapOwner page under feature flag; Azure principal search; call backend; show PAT once."
- *Helm*: "Add values for `bootstrap.initialOwner` and a first‑run Job; no static tokens in pods."
- *Bootstrap testing*: "Test bootstrap flow end-to-end: configure Azure AD → start server with bootstrap → UI flow → verify OWNER privileges."

## Bootstrap workflow
- **Two endpoints**: `/api/1.0/unity-control/auth/bootstrap/token-exchange` (UI flow) and `/api/2.1/unity-catalog/admins/bootstrap-owner` (admin API)
- **UI access**: `http://localhost:3000?bootstrap=true` triggers bootstrap mode
- **Required config**: `server.bootstrap.enabled=true`, Azure AD tenant/client IDs, OAuth settings
- **Post-bootstrap**: Disable bootstrap mode, save tokens securely, transition to normal operations
- **Helm support**: Bootstrap job with Azure service principal or managed identity authentication

> Keep changes **additive**, cite evidence, and wire JCasbin checks explicitly.iscover bootstrap path*: "Trace process start → config → token file → principal → OWNER binding; cite files:lines; summarize risks & migration."
- *Add OWNER bootstrap endpoint*: "Draft additive `POST /api/2.1/unity-catalog/admins/bootstrap-owner` (preview) with conflict/forbidden semantics and examples."
- *PAT endpoints*: "Draft additive tokens endpoints under `/api/2.1/unity-catalog/tokens` with write‑once token value and hashed storage."
- *UI slice*: "Scaffold AdminBootstrapOwner page under feature flag; Azure principal search; call backend; show PAT once."
- *Helm*: "Add values for `bootstrap.initialOwner` and a first‑run Job; no static tokens in pods."
- *Bootstrap testing*: "Test bootstrap flow end-to-end: configure Azure AD → start server with bootstrap → UI flow → verify OWNER privileges."

## Bootstrap workflow
- **Two endpoints**: `/api/1.0/unity-control/auth/bootstrap/token-exchange` (UI flow) and `/api/2.1/unity-catalog/admins/bootstrap-owner` (admin API)
- **UI access**: `http://localhost:3000?bootstrap=true` triggers bootstrap mode
- **Required config**: `server.bootstrap.enabled=true`, Azure AD tenant/client IDs, OAuth settings
- **Post-bootstrap**: Disable bootstrap mode, save tokens securely, transition to normal operations
- **Helm support**: Bootstrap job with Azure service principal or managed identity authentication OSS (2025-09-05)

These repository instructions apply to **Copilot Chat**, **Copilot coding agent**, and **Copilot code review** when used in this repository. They set shared goals and guardrails for all models. Keep instructions **short, additive, and enforceable**.
## General context
- You are an expert programmer and you should be critical and ask questions as needed. If you have a better approach that works within guidelines, please suggest. You don't need to tell me things are "Perfect!" or flowery language.
- Do not assume knowledge of the codebase; ask clarifying questions if needed.
- Be open to feedback and iterate on your solutions.
- I am open to feedback, be critical where necessary.

## Project context
- This repo implements an **open‑source Unity Catalog** server + UI. Azure authentication is wired into both.
- Legacy bootstrap uses a **local non‑Azure admin** with a token at `etc/conf/token.txt`. In Kubernetes, this is cumbersome and insecure.
- Goal: Move to an **Azure‑authenticated OWNER** bootstrap, plus **PAT** issuance to manage users and automate developer token flows.

## Local development commands
- **Server logs**: Located at `etc/logs/server.log` (gzipped rotation)
- **Start server**: `./bin/start-uc-server &` (background process)
- **Stop server**: `pkill -f UnityCatalogServer`
- **Start UI**: `yarn start &` (from `ui/` directory, background process)
- **Stop UI**: `pkill -f react-scripts`
- **Server endpoint**: `http://localhost:8080` (API paths: `/api/1.0/unity-control/`, `/api/2.1/unity-catalog/`)
- **UI endpoint**: `http://localhost:3000` (bootstrap mode: `?bootstrap=true`)

## Non‑negotiable guardrails
- **API evolution**: Additive under `/api/2.1/...` only; any breaking change uses a new path version (e.g., `/api/2.2/...`). Annotate new/changed surfaces with `x-uc-stage` and `x-uc-since`, reuse existing pagination/error envelopes. See `docs/00A-API-Evolution-Policy.md` (attach to chats). 
- **Security**: No static tokens in containers; PATs are **displayed once**, stored as **hashes**; never log secrets; follow least‑privilege; explicit OWNER bindings.
- **Traceability**: Cite files and line ranges when making claims; prefer OpenAPI‑first for new control‑plane features.

## Objectives (what Copilot should optimize for)
1) **Discover** how the local non‑Azure admin is created and authorized (bootstrap path; OWNER binding).
2) **Deep‑dive JCasbin** model: model/policy files, role hierarchy, enforcement points; clarify **OWNER**.
3) **Map privileges ↔ endpoints** across `api/all.yaml` and `api/control.yaml` and fill any missing gates.
4) **UI Admin Panel** to bootstrap an Azure principal as OWNER (feature‑flagged).
5) **PAT feature**: Create/list/revoke tokens for admins/self; show value once; scope & TTL; audit.
6) **Helm operationalization**: First‑run Azure bootstrap job, secret handling, migration away from local token.

## Working style (limit‑aware)
- **Plan‑first**: Before edits, produce a short PLAN with steps, risks, and a small **tool budget**.
- **Evidence‑first**: Use narrow searches/globs; quote minimal line ranges; memoize facts into short notes.
- **Diff‑preview first**: Show diffs; apply only after approval; batch per area to minimize writes.
- **OpenAPI‑first** for control‑plane changes; then implement handlers/UI/tests.
- **Path‑specific rules** exist in `.github/instructions/*.instructions.md` – Copilot should merge them when editing those paths.

## Quick prompts
- *Discover bootstrap path*: “Trace process start → config → token file → principal → OWNER binding; cite files:lines; summarize risks & migration.”
- *Add OWNER bootstrap endpoint*: “Draft additive `POST /api/2.1/unity-catalog/admins/bootstrap-owner` (preview) with conflict/forbidden semantics and examples.”
- *PAT endpoints*: “Draft additive tokens endpoints under `/api/2.1/unity-catalog/tokens` with write‑once token value and hashed storage.”
- *UI slice*: “Scaffold AdminBootstrapOwner page under feature flag; Azure principal search; call backend; show PAT once.”
- *Helm*: “Add values for `bootstrap.initialOwner` and a first‑run Job; no static tokens in pods.”

> Keep changes **additive**, cite evidence, and wire JCasbin checks explicitly.
