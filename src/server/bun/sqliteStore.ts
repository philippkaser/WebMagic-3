import { Database } from "bun:sqlite";
import type { Account, AccountStore } from "../core/account";

/** Durable account storage for the online server (bun:sqlite, WAL). */
export class SqliteStore implements AccountStore {
  private db: Database;
  private wall: { name: string; floor: number; cause: string; at: number }[] = [];

  constructor(path: string) {
    this.db = new Database(path, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("CREATE TABLE IF NOT EXISTS accounts (token TEXT PRIMARY KEY, data TEXT NOT NULL, updated INTEGER NOT NULL)");
    this.db.exec("CREATE TABLE IF NOT EXISTS memorial (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, floor INTEGER, cause TEXT, at INTEGER)");
    this.wall = this.db.query("SELECT name, floor, cause, at FROM memorial ORDER BY id DESC LIMIT 40").all() as typeof this.wall;
  }

  async byToken(token: string): Promise<Account | null> {
    const row = this.db.query("SELECT data FROM accounts WHERE token = ?").get(token) as { data: string } | null;
    return row ? (JSON.parse(row.data) as Account) : null;
  }

  save(account: Account): void {
    this.db.query("INSERT INTO accounts (token, data, updated) VALUES (?, ?, ?) ON CONFLICT(token) DO UPDATE SET data = excluded.data, updated = excluded.updated").run(account.token, JSON.stringify(account), Date.now());
  }

  memorial() {
    return this.wall;
  }

  addMemorial(entry: { name: string; floor: number; cause: string; at: number }) {
    this.db.query("INSERT INTO memorial (name, floor, cause, at) VALUES (?, ?, ?, ?)").run(entry.name, entry.floor, entry.cause, entry.at);
    this.wall.unshift(entry);
    this.wall.length = Math.min(this.wall.length, 40);
  }
}
