# v0.2 upgrade and recovery

## Install

1. Back up the application database and encryption key. Stop accepting application requests while upgrading; do not run v0.1 and v0.2 writers concurrently.
2. Finish pending Salesforce operations and review existing busy/ambiguous deliveries before changing code.
3. Existing v0.1 database: run `database/migrations/002_release_safety.sql` in Supabase SQL Editor. New database: run `database/schema.sql` once; it already includes the migration.
4. Deploy the v0.2 source with the same encryption key and account settings. No new environment variables are required.
5. In a staging workspace, verify sign-in, configuration replacement, token refresh, a small delivery, and interrupted-request recovery. Existing sandbox approvals lack the new evidence fields and require a fresh reviewer approval.

The migration adds job leases and operation names, connection revisions, and three service-role-only RPC functions. It preserves existing deliveries and credentials. It has not been executed against a live PostgreSQL instance during source creation; validate it in staging before upgrading a used database. Roll back application code only with traffic stopped and after resolving active operations.

## Recovery decisions

| Saved state | App behavior | Operator action |
| --- | --- | --- |
| Busy; lease still valid | Recovery denied | Wait; refresh status after the request finishes. |
| Expired read/model operation | Reviewer can record findings and release lock, leaving delivery paused | Inspect state; resume when appropriate. Model requests may have incurred usage even if their response was lost. |
| Expired write with `response_recorded` checkpoint | Reviewer can release lock; remote IDs and stage are preserved | Resume and poll an existing Salesforce operation or inspect saved Jira/Git links. |
| `write_started` without a saved result | Retry and reconciliation unlock denied | Investigate the remote system; do not resubmit. |
| Legacy busy write without a reliable checkpoint | Recovery denied | Administrator investigation is required. |

For an unknown write, investigate the Jira marker, `sfda/<delivery-id>` Git branch, or Salesforce deployment monitor using your normal release process. There is no generic safe “mark resolved” button: a note is not proof that an external write did or did not occur. This version intentionally requires an administrator-assisted, case-specific recovery when remote identity cannot be established. Keep the affected delivery paused. Do not clear locks or reconciliation flags just to make retry available, and do not create a duplicate delivery as a retry for that same unknown write.

If an administrator restores a known external result into a delivery, independently verify the exact artifact/commit and target, retain evidence and actor identity in an audit event, clear prior release approvals, and revalidate before any later release. A universal database repair script is not provided because Jira issue creation, Git commits, and Salesforce submissions require different evidence.

## Release checks

The server requires a current approved plan, linked Jira stories, the exact committed artifact, a sandbox identity, and successful validation within 24 hours. Sandbox approval lasts four hours and binds its validation ID/timestamp, artifact hash, Git commit, org ID, and account version. Changed evidence requires fresh approval. Immediately before dispatch, the server checks that the remote Git branch still points to the reviewed commit.

Connection changes are blocked during active/unknown external operations. Refresh/verification updates use a connection revision so stale requests cannot overwrite newer credentials. Job completion and its audit event commit together; external APIs and the app database cannot form one transaction, so unknown-write states remain possible and fail closed.

Copado remains a manual handoff. Production deployment and automated UAT are not implemented in this release.
