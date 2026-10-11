# TimeScope 0.4.5: database and recording reliability

## Problem and evidence

The previous WASM database driver implements locks with a `.db.lock` directory.
An interrupted process can leave this directory behind. Startup then fails before
IPC, the tray, or the dashboard are initialized; there is no visible recording
failure message. Poll errors were also swallowed while the UI still said tracking
was on. A shutdown error in the tracker skipped closing the database entirely.

## Implementation plan and data guarantees

1. Replace the production WASM driver with Node's built-in SQLite, verified on
   Electron 38 (Node 22). Keep the existing SQLite file, schema, installation ID,
   and user-data directory. Use WAL, FULL durability, and a bounded busy timeout.
   OS locks disappear when their process dies; no PID file or blind lock deletion
   is necessary. Node 22.13+ is required for development.
2. Refuse to open while an older WASM `.lock` exists: those versions do not obey
   native SQLite locks. Never delete that directory automatically or assume a
   stable file proves its owner is dead. Close old copies first; if the lock
   persists, support must preserve the full profile and confirm the old process
   is gone before archiving the legacy lock. Do not run old and new releases
   against the same profile at the same time or downgrade an active WAL database.
3. Check existing database integrity and make a consistent, non-overwriting
   `backups/timescope.db.pre-native.db` snapshot before migrations or changing
   journal mode. Use SQLite snapshots for rotating backups so committed WAL
   records are included. Abort if the initial snapshot cannot be made.
4. Catch startup errors and show a native dialog even when starting hidden.
   Offer retry, open data folder, or quit; never replace history with an empty DB.
5. Show recording failures in the dashboard and tray and issue one notification
   per failure episode. Keep the last successful write timestamp and retry normal
   polls. On recovery start at the next real observation, without inventing activity
   for the missing interval. A failed IPC status fetch must not display "on".
6. Independently stop tracker, server, database, and tray during shutdown so one
   failure cannot skip the remaining cleanup. Close connections after startup
   or migration failure.

## Verification and rollout gates

- Unit/regression suite and TypeScript checks.
- Real WASM-created database compatibility; snapshot before schema migration.
- Abrupt child-process death, rollback of uncommitted rows, preserved commits,
  successful reopen, and SQLite integrity checks.
- Concurrent writers: reject conflict, never overwrite the other writer.
- Committed WAL rows appear in backups; existing snapshots are not overwritten.
- Legacy locks leave the database byte-identical and remain untouched.
- Failed writes produce error status, deduplicated notifications, and a truthful
  recovery gap; shutdown proceeds despite injected failures.
- Electron smoke test in its own temporary profile, never the user's live profile.
- Repeat the smoke tests against the packaged Windows executable, including the
  rendered Arabic error banner and RTL layout.
- Build a Windows installer and publish source plus installer/checksum on GitHub.
  Keep live installation unchanged until the user reviews the result.

This repair cannot reconstruct activity that was never recorded. It does not add
telemetry, upload activity, or change retention settings. Existing user-requested
retention remains in place; the pre-native snapshot is excluded from rotation.

## Verified locally

48 regression/recovery tests passed, TypeScript and production build passed.
Electron's normal recording and deliberately read-only recording-failure modes
passed; the latter rendered a visible Arabic alert with RTL layout. An isolated
copy of an existing offline database retained identical rows in every table after
upgrade and passed SQLite integrity checks. See `scripts/verify-upgrade.mjs` for
the repeatable offline-copy check (never point it at a running database).
