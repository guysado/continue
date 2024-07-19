import { EventEmitter } from "events";
import { Minimatch } from "minimatch";
import path from "node:path";
import { FileType, IDE } from "../index.js";
import { DEFAULT_IGNORE_DIRS, DEFAULT_IGNORE_FILETYPES } from "./ignore.js";

export interface WalkerOptions {
  isSymbolicLink?: boolean;
  path?: string;
  ignoreFiles?: string[];
  parent?: Walker | null;
  includeEmpty?: boolean;
  follow?: boolean;
  exact?: boolean;
  onlyDirs?: boolean;
  returnRelativePaths?: boolean;
  additionalIgnoreRules?: string[];
}

type Entry = [string, FileType];

class Walker extends EventEmitter {
  isSymbolicLink: boolean;
  path: string;
  basename: string;
  ignoreFiles: string[];
  ignoreRules: { [key: string]: Minimatch[] };
  parent: Walker | null;
  includeEmpty: boolean;
  root: string;
  follow: boolean;
  result: Set<string>;
  entries: Entry[] | null;
  sawError: boolean;
  exact: boolean | undefined;
  onlyDirs: boolean | undefined;
  constructor(opts: WalkerOptions = {}, protected readonly ide: IDE) {
    super(opts as any);
    this.isSymbolicLink = opts.isSymbolicLink || false;
    this.path = opts.path || process.cwd();
    this.basename = path.basename(this.path);
    this.ignoreFiles = [...(opts.ignoreFiles || [".ignore"]), ".defaultignore"];
    this.ignoreRules = {};
    this.parent = opts.parent || null;
    this.includeEmpty = !!opts.includeEmpty;
    this.root = this.parent ? this.parent.root : this.path;
    this.follow = !!opts.follow;
    this.result = this.parent ? this.parent.result : new Set();
    this.entries = null;
    this.sawError = false;
    this.exact = opts.exact;
    this.onlyDirs = opts.onlyDirs;

    if (opts.additionalIgnoreRules) {
      this.addIgnoreRules(opts.additionalIgnoreRules);
    }
  }

  sort(a: string, b: string): number {
    return a.localeCompare(b, "en");
  }

  emit(ev: string, data: any): boolean {
    let ret = false;

    if (!(this.sawError && ev === "error")) {
      if (ev === "error") {
        this.sawError = true;
      } else if (ev === "done" && !this.parent) {
        data = (Array.from(data) as any)
          .map((e: string) => (/^@/.test(e) ? `./${e}` : e))
          .sort(this.sort);
        this.result = new Set(data);
      }

      if (ev === "error" && this.parent) {
        ret = this.parent.emit("error", data);
      } else {
        ret = super.emit(ev, data);
      }
    }
    return ret;
  }

  async *start() {
    try {
      const entries = await this.ide.listDir(this.path);
      console.log({ entries });
      yield* this.onReadDir(entries);
      // console.log({ entries, result: this.result });

      // for (const file in this.result) {
      //   console.log({ file });
      //   yield file;
      // }
    } catch (err) {
      this.emit("error", err);
    }
  }

  isIgnoreFile(e: Entry): boolean {
    const p = e[0];
    return p !== "." && p !== ".." && this.ignoreFiles.indexOf(p) !== -1;
  }

  async *onReadDir(entries: Entry[]) {
    this.entries = entries;

    if (entries.length === 0) {
      if (this.includeEmpty) {
        this.result.add(this.path.slice(this.root.length + 1));
      }
      this.emit("done", this.result);
      yield this.result;
    } else {
      const hasIg = this.entries.some((e) => this.isIgnoreFile(e));

      if (hasIg) {
        this.addIgnoreFiles();
      } else {
        yield* this.filterEntries();
      }
    }
  }

  addIgnoreFiles(): void {
    const newIg = this.entries!.filter((e) => this.isIgnoreFile(e));

    let igCount = newIg.length;
    const then = () => {
      if (--igCount === 0) {
        this.filterEntries();
      }
    };

    newIg.forEach((e) => this.addIgnoreFile(e, then));
  }

  addIgnoreFile(file: Entry, then: () => void): void {
    const ig = path.resolve(this.path, file[0]);
    this.ide
      .readFile(ig)
      .then((data) => {
        this.onReadIgnoreFile(file, data, then);
      })
      .catch((err) => {
        this.emit("error", err);
      });
  }

  onReadIgnoreFile(file: Entry, data: string, then: () => void): void {
    const mmopt = {
      matchBase: true,
      dot: true,
      flipNegate: true,
      nocase: true,
    };
    const rules = data
      .split(/\r?\n/)
      .filter((line) => !/^#|^$/.test(line.trim()))
      .map((rule) => {
        return new Minimatch(rule.trim(), mmopt);
      });

    this.ignoreRules[file[0]] = rules;

    then();
  }

  addIgnoreRules(rules: string[]) {
    const mmopt = {
      matchBase: true,
      dot: true,
      flipNegate: true,
      nocase: true,
    };
    const minimatchRules = rules
      .filter((line) => !/^#|^$/.test(line.trim()))
      .map((rule) => {
        return new Minimatch(rule.trim(), mmopt);
      });

    this.ignoreRules[".defaultignore"] = minimatchRules;
  }

  async *filterEntries() {
    const filtered = this.entries!.map((entry) => {
      const passFile = this.filterEntry(entry[0]);
      const passDir = this.filterEntry(entry[0], true);
      return passFile || passDir ? [entry, passFile, passDir] : false;
    }).filter((e) => e) as [Entry, boolean, boolean][];
    let entryCount = filtered.length;
    if (entryCount === 0) {
      this.emit("done", this.result);
      yield this.result;
    } else {
      const then = () => {
        if (--entryCount === 0) {
          // Otherwise in onlyDirs mode, nothing would be returned
          if (this.onlyDirs && this.path !== this.root) {
            this.result.add(this.path.slice(this.root.length + 1));
          }
          this.emit("done", this.result);
        }
      };

      for (const [entry, file, dir] of filtered) {
        for await (const statResult of this.stat(entry, file, dir, then)) {
          yield statResult;
        }
      }
    }
  }

  entryIsDirectory(entry: Entry) {
    const Directory = 2 as FileType.Directory;
    return entry[1] === Directory;
  }

  entryIsSymlink(entry: Entry) {
    const Directory = 64 as FileType.SymbolicLink;
    return entry[1] === Directory;
  }

  async *onstat(entry: Entry, file: boolean, dir: boolean, then: () => void) {
    const abs = this.path + "/" + entry[0];
    const isSymbolicLink = this.entryIsSymlink(entry);
    if (!this.entryIsDirectory(entry)) {
      if (file && !this.onlyDirs) {
        this.result.add(abs.slice(this.root.length + 1));
      }
      then();
    } else {
      if (dir) {
        yield* this.walker(
          entry[0],
          { isSymbolicLink, exact: this.filterEntry(entry[0] + "/") },
          then,
        );
      } else {
        then();
      }
    }
  }

  async *stat(
    entry: Entry,
    file: boolean,
    dir: boolean,
    then: () => void,
  ): any {
    yield* this.onstat(entry, file, dir, then);
  }

  walkerOpt(entry: string, opts: Partial<WalkerOptions>): WalkerOptions {
    return {
      path: this.path + "/" + entry,
      parent: this,
      ignoreFiles: this.ignoreFiles,
      follow: this.follow,
      includeEmpty: this.includeEmpty,
      onlyDirs: this.onlyDirs,
      ...opts,
    };
  }

  async *walker(entry: string, opts: Partial<WalkerOptions>, then: () => void) {
    const walker = new Walker(this.walkerOpt(entry, opts), this.ide);

    walker.on("done", then);
    yield* walker.start();
  }

  filterEntry(
    entry: string,
    partial?: boolean,
    entryBasename?: string,
  ): boolean {
    let included = true;

    if (this.parent && this.parent.filterEntry) {
      const parentEntry = this.basename + "/" + entry;
      const parentBasename = entryBasename || entry;
      included = this.parent.filterEntry(parentEntry, partial, parentBasename);
      if (!included && !this.exact) {
        return false;
      }
    }

    this.ignoreFiles.forEach((f) => {
      if (this.ignoreRules[f]) {
        this.ignoreRules[f].forEach((rule) => {
          if (rule.negate !== included) {
            const isRelativeRule =
              entryBasename &&
              rule.globParts.some(
                (part) => part.length <= (part.slice(-1)[0] ? 1 : 2),
              );

            const match =
              rule.match("/" + entry) ||
              rule.match(entry) ||
              (!!partial &&
                (rule.match("/" + entry + "/") ||
                  rule.match(entry + "/") ||
                  (rule.negate &&
                    (rule.match("/" + entry, true) ||
                      rule.match(entry, true))) ||
                  (isRelativeRule &&
                    (rule.match("/" + entryBasename + "/") ||
                      rule.match(entryBasename + "/") ||
                      (rule.negate &&
                        (rule.match("/" + entryBasename, true) ||
                          rule.match(entryBasename, true)))))));

            if (match) {
              included = rule.negate;
            }
          }
        });
      }
    });

    return included;
  }
}

const defaultOptions: WalkerOptions = {
  ignoreFiles: [".gitignore", ".continueignore"],
  onlyDirs: false,
  additionalIgnoreRules: [...DEFAULT_IGNORE_DIRS, ...DEFAULT_IGNORE_FILETYPES],
};

export async function walkDir(
  path: string,
  ide: IDE,
  _options?: WalkerOptions,
): Promise<string[]> {
  const entries: string[] = [];
  const options = { ...defaultOptions, ..._options };

  const walker = new Walker(
    {
      path,
      ignoreFiles: options.ignoreFiles,
      onlyDirs: options.onlyDirs,
      follow: true,
      includeEmpty: false,
      additionalIgnoreRules: options.additionalIgnoreRules,
    },
    ide,
  );

  try {
    for await (const entry of walker.start()) {
      console.log({ entry });
      entries.push(...entry);
    }
  } catch (err) {
    console.error(`Error walking directories: ${err}`);
    throw err;
  }

  const relativePaths = entries || [];

  if (options?.returnRelativePaths) {
    return relativePaths;
  }

  const pathSep = await ide.pathSep();

  if (pathSep === "/") {
    return relativePaths.map((p) => path + pathSep + p);
  }

  return relativePaths.map((p) => path + pathSep + p.split("/").join(pathSep));
}
