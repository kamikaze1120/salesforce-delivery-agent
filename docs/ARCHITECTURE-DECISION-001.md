# ADR 001 — Keep the existing runtime; make trust boundaries explicit

Status: implemented baseline documented; framework migration deferred for owner review.

The current application is a Node.js API with a static JavaScript UI on Vercel, Supabase Auth/PostgreSQL persistence, a project-owned workflow state machine, provider-specific JSON model requests, GitHub Actions runners and a project-owned Salesforce CLI/Metadata API MCP bridge. `fast-xml-parser` is an application dependency. This is not a Next.js/FastAPI/LangGraph/Temporal deployment; pgvector is not installed.

| Responsibility | Inputs | Outputs | Authority boundary |
|---|---|---|---|
| Requirements | Immutable BRD, answers, bounded org context | Source-linked requirements, gaps, stories, cases | Model proposals cannot approve scope or create evidence |
| Architecture | Approved plan and design, observed metadata | Component plan and unresolved constraints | Human review; unsupported metadata remains blocked |
| License analysis | Observed inventory, reviewed sourced rules | Passed/failed/unknown destination decisions | Model commentary cannot override deterministic entitlement checks |
| Generation | Approved scope, architecture, source context | Validated metadata package | Strict path/schema checks; no tool calls from generated instructions |
| Tests | Reviewed immutable suite and policy | Actual method/assertion evidence | Missing execution blocks; a model cannot declare a pass |
| Repair | Classified failure, original BRD, frozen expectations | Bounded implementation revision | Cannot edit expectations, permissions or unknown external writes |
| Deployment | Exact artifact, trusted runner policy, approval | Durable operation journal and stage evidence | Fixed tools, verified org, GitHub environment protection, production approval |

These are functional responsibilities, not separately deployed autonomous agents. Durable job claiming and checkpoints live in PostgreSQL; execution lives in GitHub Actions. Workspace membership and encrypted per-workspace connections protect tenant boundaries. The service-role backend is trusted and must remain private. Org-wide mutation locks use migration 004 and cover pipeline and direct sandbox writes across workspaces. Per-delivery GitHub concurrency is an additional control; neither coordinates out-of-platform deployment clients.

A framework migration should be a separate reviewed decision with restart/replay tests, tenant isolation tests, secret-handling review, migration/rollback procedures and parity against these contracts. No new framework or skill is needed to implement the current controls. Existing workflow state must not be discarded merely to adopt another orchestration library.
