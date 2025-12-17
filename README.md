# mongo-toolkit

MongoDB administrators run into the same handful of emergencies again and again. **mongo-toolkit** packages those battle-tested checks into a categorized CLI similar to [iqtoolkit/pgtools](https://github.com/iqtoolkit/pgtools) so that you can list, describe, and execute diagnostics in seconds.

## Why this exists
- 🧭 **Curated playbooks** – issues are organized (performance, replication, storage, operations, security) so you can jump straight to the right fix.
- ⚙️ **Command-line friendly** – `mongo-toolkit run performance:slow-queries --uri ...` runs actionable checks without digging through dashboards.
- 🧱 **Extensible** – new detectors are plain JavaScript modules; duplicate the pattern to add site-specific playbooks.

## Getting started
```bash
# Install dependencies
npm install

# Optional: configure a default connection string via .env
cp .env.example .env
# Edit .env and set MONGODB_URI=...

# List top-level categories
npx mongo-toolkit categories

# Inspect available issues in the performance bucket
npx mongo-toolkit list performance

# Run a diagnostic (requires connection string)
npx mongo-toolkit run performance:slow-queries \
  --uri "mongodb://admin:secret@db01/?replicaSet=rs0" \
  --database app

# Or, if MONGODB_URI is set (for example via .env), you can omit --uri:
npx mongo-toolkit run performance:slow-queries --database app

# You can also use the short alias:
npx mongo-toolkit run performance:slow-queries -u "mongodb://admin:secret@db01/?replicaSet=rs0" --database app
```

## Seeding dummy data
If you want a quick dataset to test diagnostics against, you can seed a database with dummy documents.

```bash
# 1) Install deps
npm install

# 2) Create a local .env (never commit it)
cp .env.example .env

# 3) Edit .env and set MONGODB_URI, then run:
npm run seed -- --db app --collection dummy_records --count 1000000 --drop
```

> ℹ️ All commands accept `--json` to emit machine-readable output, perfect for automation or GitHub Actions.

## Commands
| Command | Description |
| --- | --- |
| `mongo-toolkit categories` | Print every category and how many checks it contains. |
| `mongo-toolkit list [category]` | Show every diagnostic (optionally scoped to a category). |
| `mongo-toolkit describe <issueId>` | Display metadata, tags, and tunable options for a diagnostic. |
| `mongo-toolkit run <issueId> --uri <uri> [options]` | Execute a diagnostic against a live deployment and print a status summary. |

## Current issue catalog
Category | Issue | What it checks
--- | --- | ---
Performance | `performance:slow-queries` | Reads `system.profile` to bubble up the slowest operations beyond a configurable latency budget.
Performance | `performance:wiredtiger-cache` | Flags WiredTiger cache pressure when utilization or dirty bytes stay high.
Replication | `replication:lag` | Calculates worst-case lag between primaries and the slowest secondaries.
Replication | `replication:oplog-window` | Measures how many hours of history remain in `local.oplog.rs`.
Storage | `storage:fragmentation` | Compares logical data size with on-disk usage to highlight bloated collections.
Storage | `storage:largest-collections` | Lists the heaviest collections in the target database to plan archiving or sharding.
Operations | `operations:connection-pressure` | Watches the live connection budget and reports when you are close to maxing out the listener.
Operations | `operations:long-running-ops` | Surfaces active operations exceeding your long-run threshold (default 60s).
Security | `security:authorization-mode` | Confirms that `security.authorization` is set to `enabled` on the server.
Security | `security:overprivileged-users` | Lists users that hold cluster-wide roles such as `root` or `readWriteAnyDatabase`.

Each issue returns a simple payload: `status` (`ok`, `warn`, `critical`, `info`, `error`), a summary sentence, optional `details`, and a recommended next action.

## Adding new diagnostics
1. Create a new file in `src/issues/` or append to the closest category file.
2. Export objects that follow the structure used elsewhere:
   ```js
   module.exports = [
     {
       id: 'category:identifier',
       category: 'category',
       title: 'Title',
       severity: 'medium',
       tags: ['tag'],
       description: 'What this check does',
       async run({ client, db, adminDb, state, options }) {
         // return { status, summary, details?, recommendation? }
       },
     },
   ];
   ```
3. The CLI automatically picks it up; re-run `list` or `describe` to verify.

## Roadmap
- 📡 Pluggable output adapters (Slack/webhook reporters)
- 🧪 Regression test harness with mocked Mongo responses
- 🔁 Watch mode for continuous health polling

Feel free to open an issue or PR if you have a favorite MongoDB firefight that deserves a first-class command.
