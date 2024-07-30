import {
  Chunk,
  ContinueConfig,
  EmbeddingsProvider,
  IDE,
  IndexingProgressUpdate,
  SiteIndexingConfig,
} from "../../index.js";
import {
  editConfigJson,
  getDocsSqlitePath,
  getLanceDbPath,
} from "../../util/paths.js";
import { Article, chunkArticle, pageToArticle } from "./article.js";
import { crawlPage } from "./crawl.js";
import {
  downloadFromS3,
  getS3Filename,
  S3Buckets,
  SiteIndexingResults,
} from "./preIndexed.js";
import preIndexedDocs from "./preIndexedDocs.js";
import TransformersJsEmbeddingsProvider from "../embeddings/TransformersJsEmbeddingsProvider.js";
import { ConfigHandler } from "../../config/ConfigHandler.js";
import lancedb, { Connection } from "vectordb";
import { GlobalContext } from "../../util/GlobalContext.js";
import DocsContextProvider from "../../context/providers/DocsContextProvider.js";
import { open, type Database } from "sqlite";
import sqlite3 from "sqlite3";
import { Telemetry } from "../../util/posthog.js";
import { runSqliteMigrations, runLanceMigrations } from "./migrations.js";

// Purposefully lowercase because lancedb converts
export interface LanceDbDocsRow {
  title: string;
  starturl: string;
  // Chunk
  content: string;
  path: string;
  startline: number;
  endline: number;
  vector: number[];
  [key: string]: any;
}

export interface SqliteDocsRow {
  title: string;
  startUrl: string;
  favicon: string;
}

export type AddParams = {
  siteIndexingConfig: SiteIndexingConfig;
  chunks: Chunk[];
  embeddings: number[][];
  favicon?: string;
};

export class DocsService {
  static lanceTableName = "docs";
  static sqlitebTableName = "docs";
  static preIndexedDocsEmbeddingsProvider =
    new TransformersJsEmbeddingsProvider();

  private docsIndexingQueue = new Set<string>();
  private globalContext = new GlobalContext();
  private lanceTableNamesSet = new Set<string>();

  private config!: ContinueConfig;
  private sqliteTable?: Database;

  // If we are instantiating a new DocsService from `getContextItems()`,
  // we have access to the direct config object.
  // When instantiating the DocsService from core, we have access
  // to a ConfigHandler instance.
  constructor(
    configOrHandler: ConfigHandler | ContinueConfig,
    private readonly ide: IDE,
  ) {
    this.init(configOrHandler);
  }

  async isJetBrainsAndPreIndexedDocsProvider(): Promise<boolean> {
    const isJetBrains = await this.isJetBrains();

    const isPreIndexedDocsProvider =
      this.config.embeddingsProvider.id ===
      DocsService.preIndexedDocsEmbeddingsProvider.id;

    return isJetBrains && isPreIndexedDocsProvider;
  }

  /*
   * Currently, we generate and host embeddings for pre-indexed docs using transformers.js.
   * However, we don't ship transformers.js with the JetBrains extension.
   * So, we only include pre-indexed docs in the submenu for non-JetBrains IDEs.
   */
  async canUsePreindexedDocs() {
    const isJetBrains = await this.isJetBrains();
    return !isJetBrains;
  }

  async delete(startUrl: string) {
    await this.deleteFromLance(startUrl);
    await this.deleteFromSqlite(startUrl);
    this.deleteFromConfig(startUrl);
  }

  async has(startUrl: string): Promise<Promise<boolean>> {
    const db = await this.getOrCreateSqliteDb();
    const title = await db.get(
      `SELECT title FROM ${DocsService.sqlitebTableName} WHERE startUrl = ?`,
      startUrl,
    );

    return !!title;
  }

  async indexAllDocs(reIndex: boolean = false) {
    if (!this.hasDocsContextProvider()) {
      this.ide.infoPopup(
        "No 'docs' provider configured under 'contextProviders' in config.json",
      );
      return;
    }

    if (!this.config.docs || this.config.docs.length === 0) {
      this.ide.infoPopup("No entries found under 'docs' in config.json");
      return;
    }

    for (const site of this.config.docs) {
      const generator = this.indexAndAdd(site, reIndex);
      while (!(await generator.next()).done) {}
    }

    this.ide.infoPopup("Docs indexing completed");
  }

  async list() {
    const db = await this.getOrCreateSqliteDb();
    const docs = await db.all<SqliteDocsRow[]>(
      `SELECT title, startUrl, favicon FROM ${DocsService.sqlitebTableName}`,
    );

    return docs;
  }

  async *indexAndAdd(
    siteIndexingConfig: SiteIndexingConfig,
    reIndex: boolean = false,
  ): AsyncGenerator<IndexingProgressUpdate> {
    const { startUrl } = siteIndexingConfig;
    const embeddingsProvider = await this.getEmbeddingsProvider();

    if (this.docsIndexingQueue.has(startUrl)) {
      console.log("Already in queue");
      return;
    }

    if (!reIndex && (await this.has(startUrl))) {
      yield {
        progress: 1,
        desc: "Already indexed",
        status: "done",
      };
      return;
    }

    // Mark the site as currently being indexed
    this.docsIndexingQueue.add(startUrl);

    yield {
      progress: 0,
      desc: "Finding subpages",
      status: "indexing",
    };

    const articles: Article[] = [];
    let processedPages = 0;
    let maxKnownPages = 1;

    // Crawl pages and retrieve info as articles
    for await (const page of crawlPage(
      new URL(startUrl),
      siteIndexingConfig.maxDepth,
    )) {
      processedPages++;

      const article = pageToArticle(page);

      if (!article) {
        continue;
      }
      articles.push(article);

      // Use a heuristic approach for progress calculation
      const progress = Math.min(processedPages / maxKnownPages, 1);

      yield {
        progress, // Yield the heuristic progress
        desc: `Finding subpages (${page.path})`,
        status: "indexing",
      };

      // Increase maxKnownPages to delay progress reaching 100% too soon
      if (processedPages === maxKnownPages) {
        maxKnownPages *= 2;
      }
    }

    const chunks: Chunk[] = [];
    const embeddings: number[][] = [];

    // Create embeddings of retrieved articles
    console.log(`Creating embeddings for ${articles.length} articles`);

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      yield {
        progress: i / articles.length,
        desc: `Creating Embeddings: ${article.subpath}`,
        status: "indexing",
      };

      try {
        const subpathEmbeddings = await embeddingsProvider.embed(
          chunkArticle(article, embeddingsProvider.maxChunkSize).map(
            (chunk) => {
              chunks.push(chunk);

              return chunk.content;
            },
          ),
        );

        embeddings.push(...subpathEmbeddings);
      } catch (e) {
        console.warn("Error chunking article: ", e);
      }
    }

    // Add docs to databases
    console.log(`Adding ${embeddings.length} embeddings to db`);

    yield {
      progress: 0.5,
      desc: `Adding ${embeddings.length} embeddings to db`,
      status: "indexing",
    };

    // Clear old index if re-indexing.
    if (reIndex) {
      console.log("Deleting old embeddings");
      await this.delete(startUrl);
    }

    const favicon = await this.fetchFavicon(siteIndexingConfig);

    await this.add({
      siteIndexingConfig,
      chunks,
      embeddings,
      favicon,
    });

    this.docsIndexingQueue.delete(startUrl);

    yield {
      progress: 1,
      desc: "Done",
      status: "done",
    };

    console.log(`Successfully indexed: ${siteIndexingConfig.startUrl}`);
  }

  async retrieveEmbeddings(
    startUrl: string,
    vector: number[],
    nRetrieve: number,
    isRetry: boolean = false,
  ): Promise<Chunk[]> {
    const table = await this.getOrCreateLanceTable(vector);

    const docs: LanceDbDocsRow[] = await table
      .search(vector)
      .limit(nRetrieve)
      .where(`starturl = '${startUrl}'`)
      .execute();

    const hasIndexedDoc = await this.hasIndexedDoc(startUrl);

    if (!hasIndexedDoc && docs.length === 0) {
      const preIndexedDoc = preIndexedDocs[startUrl];

      if (isRetry || !preIndexedDoc) {
        return [];
      }

      await this.fetchAndAddPreIndexedDocEmbeddings(preIndexedDoc.title);
      return await this.retrieveEmbeddings(startUrl, vector, nRetrieve, true);
    }

    return docs.map((doc) => ({
      digest: doc.path,
      filepath: doc.path,
      startLine: doc.startline,
      endLine: doc.endline,
      index: 0,
      content: doc.content,
      otherMetadata: {
        title: doc.title,
      },
    }));
  }

  async getEmbeddingsProvider(isPreIndexedDoc: boolean = false) {
    const canUsePreindexedDocs = await this.canUsePreindexedDocs();

    if (isPreIndexedDoc && canUsePreindexedDocs) {
      return DocsService.preIndexedDocsEmbeddingsProvider;
    }

    return this.config.embeddingsProvider;
  }

  async getFavicon(startUrl: string) {
    const db = await this.getOrCreateSqliteDb();
    const { favicon } = await db.get(
      `SELECT favicon FROM ${DocsService.sqlitebTableName} WHERE startUrl = ?`,
      startUrl,
    );

    return favicon;
  }

  private async init(configOrHandler: ContinueConfig | ConfigHandler) {
    if (configOrHandler instanceof ConfigHandler) {
      this.config = await configOrHandler.loadConfig();
    } else {
      this.config = configOrHandler;
    }

    const embeddingsProvider = await this.getEmbeddingsProvider();
    const [mockVector] = await embeddingsProvider.embed(["mockVector"]);

    const lance = await this.getOrCreateLanceTable(mockVector);
    const sqlite = await this.getOrCreateSqliteDb();

    await runLanceMigrations(lance);
    await runSqliteMigrations(sqlite);

    if (configOrHandler instanceof ConfigHandler) {
      configOrHandler.onConfigUpdate(async (newConfig) => {
        const oldConfig = this.config;

        // Need to update class property for config at the beginning of this callback
        // to ensure downstream methods have access to the latest config.
        this.config = newConfig;

        if (oldConfig.docs !== newConfig.docs) {
          await this.syncConfigAndSqlite();
        }

        const shouldReindex =
          await this.shouldReindexDocsOnNewEmbeddingsProvider(
            newConfig.embeddingsProvider.id,
          );

        if (shouldReindex) {
          await this.reindexDocsOnNewEmbeddingsProvider(
            newConfig.embeddingsProvider,
          );
        }
      });
    }
  }

  private async syncConfigAndSqlite() {
    const sqliteDocs = await this.list();
    const sqliteDocStartUrls = sqliteDocs.map((doc) => doc.startUrl) || [];

    const configDocs = this.config.docs || [];
    const configDocStartUrls =
      this.config.docs?.map((doc) => doc.startUrl) || [];

    const newDocs = configDocs.filter(
      (doc) => !sqliteDocStartUrls.includes(doc.startUrl),
    );
    const deletedDocs = sqliteDocs.filter(
      (doc) =>
        !configDocStartUrls.includes(doc.startUrl) &&
        !preIndexedDocs[doc.startUrl],
    );

    for (const doc of newDocs) {
      console.log(`Indexing new doc: ${doc.startUrl}`);
      Telemetry.capture("add_docs_config", { url: doc.startUrl });

      const generator = this.indexAndAdd(doc);
      while (!(await generator.next()).done) {}
    }

    for (const doc of deletedDocs) {
      console.log(`Deleting doc: ${doc.startUrl}`);
      await this.delete(doc.startUrl);
    }
  }

  private hasDocsContextProvider() {
    return !!this.config.contextProviders?.some(
      (provider) =>
        provider.description.title === DocsContextProvider.description.title,
    );
  }

  private async getOrCreateSqliteDb() {
    if (!this.sqliteTable) {
      this.sqliteTable = await open({
        filename: getDocsSqlitePath(),
        driver: sqlite3.Database,
      });

      this.sqliteTable
        .exec(`CREATE TABLE IF NOT EXISTS ${DocsService.sqlitebTableName} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title STRING NOT NULL,
            startUrl STRING NOT NULL UNIQUE,
            favicon STRING
        )`);
    }

    return this.sqliteTable;
  }

  private async createLanceDocsTable(
    connection: Connection,
    initializationVector: number[],
    tableName: string,
  ) {
    const mockRowTitle = "mockRowTitle";
    const mockRow: LanceDbDocsRow[] = [
      {
        title: mockRowTitle,
        vector: initializationVector,
        starturl: "",
        content: "",
        path: "",
        startline: 0,
        endline: 0,
      },
    ];

    const table = await connection.createTable(tableName, mockRow);

    await table.delete(`title = '${mockRowTitle}'`);
  }

  private removeInvalidLanceTableNameChars(tableName: string) {
    return tableName.replace(/:/g, "");
  }

  private async getLanceTableNameFromEmbeddingsProvider() {
    const embeddingsProvider = await this.getEmbeddingsProvider();
    const embeddingsProviderId = this.removeInvalidLanceTableNameChars(
      embeddingsProvider.id,
    );
    const tableName = `${DocsService.lanceTableName}${embeddingsProviderId}`;

    return tableName;
  }

  private async getOrCreateLanceTable(initializationVector?: number[]) {
    const conn = await lancedb.connect(getLanceDbPath());
    const tableNames = await conn.tableNames();
    const tableNameFromEmbeddingsProvider =
      await this.getLanceTableNameFromEmbeddingsProvider();

    if (!tableNames.includes(tableNameFromEmbeddingsProvider)) {
      if (initializationVector) {
        await this.createLanceDocsTable(
          conn,
          initializationVector,
          tableNameFromEmbeddingsProvider,
        );
      } else {
        console.error(
          "No existing Lance DB docs table was found and no initialization " +
            "vector was passed to create one",
        );
      }
    }

    const table = await conn.openTable(tableNameFromEmbeddingsProvider);

    this.lanceTableNamesSet.add(tableNameFromEmbeddingsProvider);

    return table;
  }

  private async isJetBrains() {
    const ideInfo = await this.ide.getIdeInfo();
    return ideInfo.ideType === "jetbrains";
  }

  private async hasIndexedDoc(startUrl: string) {
    const db = await this.getOrCreateSqliteDb();
    const docs = await db.all(
      `SELECT startUrl FROM ${DocsService.sqlitebTableName} WHERE startUrl = ?`,
      startUrl,
    );

    return docs.length > 0;
  }

  private async addToLance({
    chunks,
    siteIndexingConfig,
    embeddings,
  }: AddParams) {
    const sampleVector = embeddings[0];
    const table = await this.getOrCreateLanceTable(sampleVector);

    const rows: LanceDbDocsRow[] = chunks.map((chunk, i) => ({
      vector: embeddings[i],
      starturl: siteIndexingConfig.startUrl,
      title: chunk.otherMetadata?.title || siteIndexingConfig.title,
      content: chunk.content,
      path: chunk.filepath,
      startline: chunk.startLine,
      endline: chunk.endLine,
    }));

    await table.add(rows);
  }

  private async addToSqlite({
    siteIndexingConfig: { title, startUrl },
    favicon,
  }: AddParams) {
    const db = await this.getOrCreateSqliteDb();
    await db.run(
      `INSERT INTO ${DocsService.sqlitebTableName} (title, startUrl, favicon) VALUES (?, ?, ?)`,
      title,
      startUrl,
      favicon,
    );
  }

  private addToConfig({ siteIndexingConfig }: AddParams) {
    // Handles the case where a user has manually added the doc to config.json
    // so it already exists in the file
    const doesDocExist = this.config.docs?.some(
      (doc) => doc.startUrl === siteIndexingConfig.startUrl,
    );

    if (!doesDocExist) {
      editConfigJson((config) => ({
        ...config,
        docs: [...(config.docs ?? []), siteIndexingConfig],
      }));
    }
  }

  private async add(params: AddParams) {
    await this.addToLance(params);
    await this.addToSqlite(params);

    const isPreIndexDoc = !!preIndexedDocs[params.siteIndexingConfig.startUrl];

    if (!isPreIndexDoc) {
      this.addToConfig(params);
    }
  }

  private async deleteFromLance(startUrl: string) {
    for (const tableName of this.lanceTableNamesSet) {
      const conn = await lancedb.connect(getLanceDbPath());
      const table = await conn.openTable(tableName);
      await table.delete(`starturl = '${startUrl}'`);
    }
  }

  private async deleteFromSqlite(startUrl: string) {
    const db = await this.getOrCreateSqliteDb();
    await db.run(
      `DELETE FROM ${DocsService.sqlitebTableName} WHERE startUrl = ?`,
      startUrl,
    );
  }

  deleteFromConfig(startUrl: string) {
    editConfigJson((config) => ({
      ...config,
      docs: config.docs?.filter((doc) => doc.startUrl !== startUrl) || [],
    }));
  }

  private async fetchAndAddPreIndexedDocEmbeddings(title: string) {
    const embeddingsProvider = await this.getEmbeddingsProvider(true);

    const data = await downloadFromS3(
      S3Buckets.continueIndexedDocs,
      getS3Filename(embeddingsProvider.id, title),
    );

    const siteEmbeddings = JSON.parse(data) as SiteIndexingResults;
    const startUrl = new URL(siteEmbeddings.url).toString();

    await this.add({
      siteIndexingConfig: {
        startUrl,
        title: siteEmbeddings.title,
      },
      favicon: preIndexedDocs[startUrl].faviconUrl,
      chunks: siteEmbeddings.chunks,
      embeddings: siteEmbeddings.chunks.map((c) => c.embedding),
    });
  }

  private async fetchFavicon(siteIndexingConfig: SiteIndexingConfig) {
    const faviconUrl =
      siteIndexingConfig.faviconUrl ??
      new URL("/favicon.ico", siteIndexingConfig.startUrl);

    try {
      const response = await fetch(faviconUrl);
      const arrayBuffer = await response.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          "",
        ),
      );
      const mimeType = response.headers.get("content-type") || "image/x-icon";

      return `data:${mimeType};base64,${base64}`;
    } catch {
      console.error(`Failed to fetch favicon: ${faviconUrl}`);
    }

    return undefined;
  }

  private async shouldReindexDocsOnNewEmbeddingsProvider(
    curEmbeddingsProviderId: EmbeddingsProvider["id"],
  ): Promise<boolean> {
    const isJetBrainsAndPreIndexedDocsProvider =
      await this.isJetBrainsAndPreIndexedDocsProvider();

    if (isJetBrainsAndPreIndexedDocsProvider) {
      this.ide.errorPopup(
        "The 'transformers.js' embeddings provider currently cannot be used to index " +
          "documentation in JetBrains. To enable documentation indexing, you can use " +
          "any of the other providers described in the docs: " +
          "https://docs.continue.dev/walkthroughs/codebase-embeddings#embeddings-providers",
      );

      this.globalContext.update(
        "curEmbeddingsProviderId",
        curEmbeddingsProviderId,
      );

      return false;
    }

    const lastEmbeddingsProviderId = this.globalContext.get(
      "curEmbeddingsProviderId",
    );

    if (!lastEmbeddingsProviderId) {
      // If it's the first time we're setting the `curEmbeddingsProviderId`
      // global state, we don't need to reindex docs
      this.globalContext.update(
        "curEmbeddingsProviderId",
        curEmbeddingsProviderId,
      );

      return false;
    }

    return lastEmbeddingsProviderId !== curEmbeddingsProviderId;
  }

  /**
   * Currently this deletes re-crawls + re-indexes all docs.
   * A more optimal solution in the future will be to create
   * a per-embeddings-provider table for docs.
   */
  private async reindexDocsOnNewEmbeddingsProvider(
    embeddingsProvider: EmbeddingsProvider,
  ) {
    // We use config as our source of truth here since it contains additional information
    // needed for re-crawling such as `faviconUrl` and `maxDepth`.
    const { docs } = this.config;

    if (!docs || docs.length === 0) {
      return;
    }

    this.ide.infoPopup("Reindexing docs with new embeddings provider");

    for (const doc of docs) {
      await this.delete(doc.startUrl);

      const generator = this.indexAndAdd(doc);

      while (!(await generator.next()).done) {}
    }

    // Important that this only is invoked after we have successfully
    // cleared and reindex the docs so that the table cannot end up in an
    // invalid state.
    this.globalContext.update("curEmbeddingsProviderId", embeddingsProvider.id);

    this.ide.infoPopup("Completed reindexing of all docs");
  }
}
