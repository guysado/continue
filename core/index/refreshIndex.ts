import crypto from "crypto";
import { Database, open } from "sqlite";
import sqlite3 from "sqlite3";
import {
  CodebaseIndex,
  IndexTag,
  LastModifiedMap,
  PathAndCacheKey,
  RefreshIndexResults,
} from ".";
import { getIndexSqlitePath } from "../util/paths";

export type DatabaseConnection = Database<sqlite3.Database>;

export class SqliteDb {
  static db: DatabaseConnection | null = null;

  private static async createTables(db: DatabaseConnection) {
    await db.exec(
      `CREATE TABLE IF NOT EXISTS tag_catalog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dir STRING NOT NULL,
            branch STRING NOT NULL,
            artifactId STRING NOT NULL,
            path STRING NOT NULL,
            cacheKey STRING NOT NULL,
            lastUpdated INTEGER NOT NULL
        )`
    );

    await db.exec(
      `CREATE TABLE IF NOT EXISTS global_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cacheKey STRING NOT NULL,
            dir STRING NOT NULL,
            branch STRING NOT NULL,
            artifactId STRING NOT NULL
        )`
    );
  }

  static async get() {
    if (SqliteDb.db) {
      return SqliteDb.db;
    }

    SqliteDb.db = await open({
      filename: getIndexSqlitePath(),
      driver: sqlite3.Database,
    });

    await SqliteDb.createTables(SqliteDb.db);

    return SqliteDb.db;
  }
}

async function getSavedItemsForTag(
  tag: IndexTag
): Promise<{ path: string; cacheKey: string; lastUpdated: number }[]> {
  const db = await SqliteDb.get();
  const stmt = await db.prepare(
    `SELECT path, cacheKey, lastUpdated FROM tag_catalog
    WHERE dir = ? AND branch = ? AND artifactId = ?`,
    tag.directory,
    tag.branch,
    tag.artifactId
  );
  const rows = await stmt.all();
  return rows;
}

interface PathAndOptionalCacheKey {
  path: string;
  cacheKey?: string;
}

async function getAddRemoveForTag(
  tag: IndexTag,
  currentFiles: LastModifiedMap,
  readFile: (path: string) => Promise<string>
): Promise<[PathAndCacheKey[], PathAndCacheKey[]]> {
  const newLastUpdatedTimestamp = Date.now();

  const saved = await getSavedItemsForTag(tag);

  const add: PathAndCacheKey[] = [];
  const updateNewVersion: PathAndCacheKey[] = [];
  const updateOldVersion: PathAndCacheKey[] = [];
  const remove: PathAndCacheKey[] = [];

  for (let item of saved) {
    const { lastUpdated, ...pathAndCacheKey } = item;

    if (currentFiles[item.path] === undefined) {
      // Was indexed, but no longer exists. Remove
      remove.push(pathAndCacheKey);
    } else {
      // Exists in old and new, so determine whether it was updated
      if (lastUpdated < currentFiles[item.path]) {
        // Change was made after last update
        updateNewVersion.push({
          path: pathAndCacheKey.path,
          cacheKey: calculateHash(await readFile(pathAndCacheKey.path)),
        });
        updateOldVersion.push(pathAndCacheKey);
      } else {
        // Already updated, do nothing
      }

      // Remove so we can check leftovers afterward
      delete currentFiles[item.path];
    }
  }

  // Any leftover in current files need to be added
  add.push(
    ...(await Promise.all(
      Object.keys(currentFiles).map(async (path) => {
        const fileContents = await readFile(path);
        return { path, cacheKey: calculateHash(fileContents) };
      })
    ))
  );

  const db = await SqliteDb.get();

  // Update rows of files that have been modified
  for (let { path, cacheKey } of updateNewVersion) {
    await db.run(
      `UPDATE tag_catalog SET
          cacheKey = ?,
          lastUpdated = ?
       WHERE
          path = ? AND
          dir = ? AND
          branch = ? AND
          artifactId = ?
      `,
      cacheKey,
      newLastUpdatedTimestamp,
      path,
      tag.directory,
      tag.branch,
      tag.artifactId
    );
  }

  // Remove all removed from the tag_catalog table
  if (remove.length > 0) {
    await db.run(
      `DELETE FROM tag_catalog WHERE
          path IN (?) AND
          dir = ? AND
          branch = ? AND
          artifactId = ?
      `,
      remove.map((r) => `'${r.path}'`).join(", "),
      tag.directory,
      tag.branch,
      tag.artifactId
    );
  }

  // Add all added to the tag_catalog table
  for (let { path, cacheKey } of add) {
    await db.run(
      `INSERT INTO tag_catalog (path, cacheKey, lastUpdated, dir, branch, artifactId) VALUES (?, ?, ?, ?, ?, ?)`,
      path,
      cacheKey,
      newLastUpdatedTimestamp,
      tag.directory,
      tag.branch,
      tag.artifactId
    );
  }

  return [
    [...add, ...updateNewVersion],
    [...remove, ...updateOldVersion],
  ];
}

/**
 * Check the global cache for items with this cacheKey for the given artifactId.
 * Return all of the tags that it exists under, which could be an empty array
 */
async function getTagsFromGlobalCache(
  cacheKey: string,
  artifactId: string
): Promise<IndexTag[]> {
  const db = await SqliteDb.get();
  const stmt = await db.prepare(
    `SELECT dir, branch, artifactId FROM global_cache WHERE cacheKey = ? AND artifactId = ?`
  );
  const rows = await stmt.all(cacheKey, artifactId);
  return rows;
}

function calculateHash(fileContents: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(fileContents);
  return hash.digest("hex");
}

export async function getComputeDeleteAddRemove(
  tag: IndexTag,
  currentFiles: LastModifiedMap,
  readFile: (path: string) => Promise<string>
): Promise<RefreshIndexResults> {
  const [add, remove] = await getAddRemoveForTag(tag, currentFiles, readFile);

  const compute: PathAndCacheKey[] = [];
  const del: PathAndCacheKey[] = [];
  const addTag: PathAndCacheKey[] = [];
  const removeTag: PathAndCacheKey[] = [];

  for (let { path, cacheKey } of add) {
    const existingTags = await getTagsFromGlobalCache(cacheKey, tag.artifactId);
    if (existingTags.length > 0) {
      addTag.push({ path, cacheKey });
    } else {
      compute.push({ path, cacheKey });
    }
  }

  for (let { path, cacheKey } of remove) {
    const existingTags = await getTagsFromGlobalCache(cacheKey, tag.artifactId);
    if (existingTags.length > 1) {
      removeTag.push({ path, cacheKey });
    } else {
      if (existingTags.length === 0) {
        console.warn("Existing tags should not be empty when trying to remove");
      }

      del.push({ path, cacheKey });
    }
  }

  const results = {
    compute,
    del,
    addTag,
    removeTag,
  };

  // Update the global cache
  const globalCacheIndex = await GlobalCacheCodeBaseIndex.create();
  for await (let _ of globalCacheIndex.update(tag, results)) {
  }

  return results;
}

class GlobalCacheCodeBaseIndex implements CodebaseIndex {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }
  artifactId: string = "globalCache";

  static async create(): Promise<GlobalCacheCodeBaseIndex> {
    return new GlobalCacheCodeBaseIndex(await SqliteDb.get());
  }

  async *update(
    tag: IndexTag,
    results: RefreshIndexResults
  ): AsyncGenerator<number> {
    const add = [...results.compute, ...results.addTag];
    const remove = [...results.del, ...results.removeTag];
    await Promise.all([
      ...add.map(({ cacheKey }) => {
        return this.computeOrAddTag(cacheKey, tag);
      }),
      ...remove.map(({ cacheKey }) => {
        return this.deleteOrRemoveTag(cacheKey, tag);
      }),
    ]);
    yield 1;
  }

  private async computeOrAddTag(
    cacheKey: string,
    tag: IndexTag
  ): Promise<void> {
    await this.db.run(
      "INSERT INTO global_cache (cacheKey, dir, branch, artifactId) VALUES (?, ?, ?, ?)",
      cacheKey,
      tag.directory,
      tag.branch,
      tag.artifactId
    );
  }
  private async deleteOrRemoveTag(
    cacheKey: string,
    tag: IndexTag
  ): Promise<void> {
    await this.db.run(
      "DELETE FROM global_cache WHERE cacheKey = ? AND dir = ? AND branch = ? AND artifactId = ?",
      cacheKey,
      tag.directory,
      tag.branch,
      tag.artifactId
    );
  }
}
