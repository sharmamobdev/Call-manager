import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";

type SqlJsDatabase = any;
type SqlJsStatic = any;
const initSqlJsTyped = initSqlJs as any;

class Statement {
  sql: string;
  db: SqlJsDatabase;
  constructor(sql: string, db: SqlJsDatabase) {
    this.sql = sql;
    this.db = db;
  }
  run(...params: any[]) {
    this.db.run(this.sql, params);
    return { changes: this.db.getRowsModified() };
  }
  get(...params: any[]) {
    const stmt = this.db.prepare(this.sql);
    if (params.length > 0) stmt.bind(params);
    let row: any;
    if (stmt.step()) row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  all(...params: any[]) {
    const stmt = this.db.prepare(this.sql);
    if (params.length > 0) stmt.bind(params);
    const rows: any[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }
}

let SQL: SqlJsStatic;
let dbInstance: SqlJsDatabase | null = null;
let dbPath: string = "";

export async function initDatabase(filePath: string) {
  SQL = await initSqlJsTyped();
  dbPath = filePath;
  if (fs.existsSync(filePath)) {
    const buffer = fs.readFileSync(filePath);
    dbInstance = new SQL.Database(buffer);
  } else {
    dbInstance = new SQL.Database();
  }
  dbInstance.run("PRAGMA journal_mode = WAL");
  dbInstance.run("PRAGMA foreign_keys = ON");
}

export function getDb(): SqlJsDatabase {
  if (!dbInstance) throw new Error("Database not initialized");
  return dbInstance;
}

export function prepare(sql: string) {
  if (!dbInstance) throw new Error("Database not initialized");
  return new Statement(sql, dbInstance);
}

export function exec(sql: string) {
  if (!dbInstance) throw new Error("Database not initialized");
  dbInstance.exec(sql);
}

export function saveDatabase() {
  if (!dbInstance || !dbPath) return;
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, buffer);
}
