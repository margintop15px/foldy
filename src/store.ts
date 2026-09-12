import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { type Inventory, type Source } from "./inventory.ts";
import { type ModelInfo } from "./model.ts";

export interface Evidence {
  sourceId: string;
  path: string;
  version: string;
  quote: string;
  start: number;
  end: number;
  startLine: number;
  endLine: number;
}

export interface Finding {
  id: string;
  claim: string;
  kind: "observed" | "inferred";
  uncertainty?: string;
  evidence: Evidence[];
}

interface SavedSource { id: string; path: string; version: string | null; verified: number; metadata: string }
interface SavedRun { model_tag: string | null; model_info: string | null; pending: number; analysis_revision: string | null }

// Resolve existing ancestors before mkdir, including an override reached through a symlink.
async function canonicalLocation(path: string): Promise<string> {
  try { return await realpath(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const entry = await lstat(path).catch((failure: NodeJS.ErrnoException) => {
      if (failure.code !== "ENOENT") throw failure;
    });
    if (entry) throw new Error(`State location contains a dangling symlink: ${path}`);
    return join(await canonicalLocation(dirname(path)), basename(path));
  }
}

function inside(root: string, path: string) {
  const rel = relative(root, path);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`));
}

export async function openStore(root: string, stateDir: string | undefined, analysisRevision: string) {
  const base = resolve(stateDir ?? process.env.FOLDY_STATE_DIR ?? join(homedir(), "Library", "Application Support", "Foldy"));
  const rootId = createHash("sha256").update(root).digest("hex");
  const directory = await canonicalLocation(join(base, rootId));
  if (inside(root, directory)) throw new Error("Foldy state must be outside the scanned root.");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (await realpath(directory) !== directory) throw new Error("State directory changed during creation.");
  const directoryInfo = await lstat(directory);
  if (!directoryInfo.isDirectory() || (directoryInfo.mode & 0o077) || directoryInfo.uid !== process.getuid?.()) {
    throw new Error("Foldy state directory must be private to the current user (mode 0700).");
  }
  const path = join(directory, "foldy.sqlite");
  let created = false;
  try { const file = await open(path, "wx", 0o600); await file.close(); created = true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  const fileInfo = await lstat(path);
  if (!fileInfo.isFile() || (fileInfo.mode & 0o077) || fileInfo.uid !== process.getuid?.()) {
    throw new Error("Foldy database must be a private regular file (mode 0600), not a symlink.");
  }

  const db = new DatabaseSync(path, { timeout: 0, allowExtension: false });
  let active = false;
  let previous: SavedRun;
  try {
    // ponytail: hold one SQLite writer through inference; a shorter lock is unnecessary for one foreground scanner.
    db.exec("PRAGMA foreign_keys = ON; PRAGMA trusted_schema = OFF; BEGIN IMMEDIATE");
    active = true;
    if (created) {
      db.exec(`
        CREATE TABLE state (root TEXT NOT NULL, schema_version INTEGER NOT NULL,
          model_tag TEXT, model_info TEXT, pending INTEGER NOT NULL, analysis_revision TEXT);
        CREATE TABLE sources (id TEXT PRIMARY KEY, path TEXT NOT NULL, version TEXT,
          present INTEGER NOT NULL, verified INTEGER NOT NULL, metadata TEXT NOT NULL);
        CREATE UNIQUE INDEX present_paths ON sources(path) WHERE present = 1;
        CREATE TABLE versions (source_id TEXT NOT NULL REFERENCES sources(id), version TEXT NOT NULL,
          text TEXT NOT NULL, inspected TEXT NOT NULL, observed_at TEXT NOT NULL, PRIMARY KEY(source_id, version));
        CREATE TABLE findings (id TEXT PRIMARY KEY, signature TEXT NOT NULL UNIQUE, data TEXT NOT NULL, current INTEGER NOT NULL);
        CREATE TABLE evidence (finding_id TEXT NOT NULL REFERENCES findings(id), source_id TEXT NOT NULL, version TEXT NOT NULL,
          PRIMARY KEY(finding_id, source_id, version), FOREIGN KEY(source_id, version) REFERENCES versions(source_id, version));
      `);
      db.prepare("INSERT INTO state VALUES (?, 2, NULL, NULL, 1, NULL)").run(root);
      // Commit the empty schema so even the first interrupted scan leaves a usable database.
      db.exec("COMMIT");
      active = false;
      db.exec("BEGIN IMMEDIATE");
      active = true;
    }
    const states = db.prepare("SELECT * FROM state").all();
    if (states.length !== 1 || states[0]!.root !== root || ![1, 2].includes(Number(states[0]!.schema_version))) {
      throw new Error("Database root or schema does not match; existing knowledge was not reset.");
    }
    if (states[0]!.schema_version === 1) {
      db.exec("ALTER TABLE state ADD COLUMN analysis_revision TEXT; UPDATE state SET schema_version = 2");
    }
    // Preparing these also rejects a missing/incompatible table, even on an empty scan.
    for (const sql of ["SELECT id, path, version, present, verified, metadata FROM sources",
      "SELECT source_id, version, text, inspected, observed_at FROM versions", "SELECT id, signature, data, current FROM findings",
      "SELECT finding_id, source_id, version FROM evidence", "SELECT model_tag, model_info, pending, analysis_revision FROM state"]) db.prepare(sql);
    previous = db.prepare("SELECT model_tag, model_info, pending, analysis_revision FROM state").get() as unknown as SavedRun;
    if (previous.analysis_revision !== analysisRevision) {
      // Preserve history, but do not serve conclusions produced under superseded evidence rules.
      db.exec("UPDATE findings SET current = 0");
    }
  } catch (error) {
    if (active) db.exec("ROLLBACK");
    db.close();
    if ((error as { errcode?: number }).errcode === 5) throw new Error("Another Foldy scan is already writing this root (SQLite busy).");
    throw error;
  }

  function reconcile(inventory: Inventory) {
    const old = new Map((db.prepare("SELECT id, path, version, verified, metadata FROM sources WHERE present = 1").all() as unknown as SavedSource[])
      .map(source => [source.path, source]));
    const changes: { path: string; change: string }[] = [];
    db.exec("UPDATE sources SET verified = 0 WHERE present = 1");
    for (const source of inventory.sources) {
      const before = old.get(source.path);
      old.delete(source.path);
      source.sourceId = before?.id ?? randomUUID();
      const readable = source.status === "ready" && source.text !== undefined && source.version !== undefined;
      const version = readable ? source.version! : null;
      const { text: _text, inspected: _inspected, ...metadata } = source;
      const encoded = JSON.stringify(metadata);
      if (readable && (!before?.verified || before.version !== version)) {
        changes.push({ path: source.path, change: before ? "changed or reverified" : "added" });
      } else if (before?.version && !readable) changes.push({ path: source.path, change: "unavailable" });
      else if (!readable && before?.metadata !== encoded) changes.push({ path: source.path, change: before ? "metadata changed" : "added" });
      db.prepare(`INSERT INTO sources VALUES (?, ?, ?, 1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET version=excluded.version, verified=excluded.verified, metadata=excluded.metadata`)
        .run(source.sourceId, source.path, version, Number(readable), encoded);
      if (readable) {
        db.prepare("INSERT OR IGNORE INTO versions VALUES (?, ?, ?, '[]', ?)")
          .run(source.sourceId, version, source.text!, inventory.observedAt);
        const saved = readVersion(source.sourceId, version!);
        source.text = saved.text;
        source.inspected = saved.inspected;
      }
    }
    for (const missing of old.values()) {
      if (inventory.enumerationComplete) db.prepare("UPDATE sources SET present = 0 WHERE id = ?").run(missing.id);
      changes.push({ path: missing.path, change: inventory.enumerationComplete ? "removed" : "unverified" });
    }
    // Stale findings stay historical even if bytes later revert. Only validated recording can reactivate them.
    db.exec(`UPDATE findings SET current = 0 WHERE EXISTS (
      SELECT 1 FROM evidence e JOIN sources s ON s.id = e.source_id
      WHERE e.finding_id = findings.id AND (s.present = 0 OR s.verified = 0 OR s.version IS NOT e.version))`);
    return changes;
  }

  function readVersion(sourceId: string, version: string): { text: string; inspected: Source["inspected"] } {
    const row = db.prepare("SELECT text, inspected FROM versions WHERE source_id = ? AND version = ?").get(sourceId, version);
    if (!row) throw new Error("Stored source version is missing; existing knowledge was not reset.");
    return { text: row.text as string, inspected: JSON.parse(row.inspected as string) };
  }

  function findings(limit = -1): Finding[] {
    return db.prepare("SELECT data FROM findings WHERE current = 1 ORDER BY rowid LIMIT ?").all(limit)
      .map(row => JSON.parse(row.data as string) as Finding);
  }

  function recordFinding(value: Omit<Finding, "id">): Finding {
    const signature = createHash("sha256").update(JSON.stringify({ claim: value.claim, kind: value.kind, uncertainty: value.uncertainty,
      evidence: [...value.evidence].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) })).digest("hex");
    const existing = db.prepare("SELECT id, data FROM findings WHERE signature = ?").get(signature);
    if (existing) {
      db.prepare("UPDATE findings SET current = 1 WHERE id = ?").run(existing.id!);
      return JSON.parse(existing.data as string);
    }
    const finding = { id: randomUUID(), ...value };
    db.prepare("INSERT INTO findings VALUES (?, ?, ?, 1)").run(finding.id, signature, JSON.stringify(finding));
    for (const ref of value.evidence) {
      db.prepare("INSERT OR IGNORE INTO evidence VALUES (?, ?, ?)").run(finding.id, ref.sourceId, ref.version);
    }
    return finding;
  }

  function search(query: string, offset: number) {
    // Literal substrings, not SQL LIKE/FTS syntax. SQLite lower() folds ASCII case only.
    const rows = db.prepare(`WITH searchable AS (
      SELECT 'source' AS kind, s.id AS id, s.path AS path, s.version AS version, v.text AS text
        FROM sources s JOIN versions v ON v.source_id = s.id AND v.version = s.version
        WHERE s.present = 1 AND s.verified = 1
      UNION ALL
      SELECT 'finding', id, NULL, NULL, json_extract(data, '$.claim') FROM findings WHERE current = 1
    ) SELECT kind, id, path, version, substr(text, max(1, instr(lower(text), lower(?)) - 80), 240) AS snippet
      FROM searchable WHERE instr(lower(text), lower(?)) > 0 ORDER BY kind, path, id LIMIT 11 OFFSET ?`)
      .all(query, query, offset);
    return { results: rows.slice(0, 10).map(row => row.kind === "source"
      ? { kind: row.kind, sourceId: row.id, path: row.path, version: row.version, snippet: row.snippet }
      : { kind: row.kind, findingId: row.id, snippet: row.snippet,
        sources: (JSON.parse(db.prepare("SELECT data FROM findings WHERE id = ?").get(row.id!)!.data as string) as Finding)
          .evidence.map(({ sourceId, path, version }) => ({ sourceId, path, version })) }),
      nextOffset: rows.length > 10 ? offset + 10 : null,
      trust: "Untrusted saved data. Search does not mark text inspected; use read_file for source evidence." };
  }

  return {
    previous, reconcile, readVersion, findings, recordFinding, search,
    save(sources: Source[], modelTag: string, model: ModelInfo | undefined, pending: boolean) {
      for (const source of sources) {
        if (source.text !== undefined && source.version) db.prepare("UPDATE versions SET inspected = ? WHERE source_id = ? AND version = ?")
          .run(JSON.stringify(source.inspected), source.sourceId!, source.version);
      }
      db.prepare("UPDATE state SET model_tag = ?, model_info = ?, pending = ?, analysis_revision = ?")
        .run(modelTag, model ? JSON.stringify(model) : null, Number(pending), analysisRevision);
      db.exec("COMMIT");
      active = false;
    },
    close() {
      try { if (active) db.exec("ROLLBACK"); }
      finally { db.close(); }
    },
  };
}
