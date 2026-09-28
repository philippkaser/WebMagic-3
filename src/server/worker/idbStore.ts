import type { Account, AccountStore } from "../core/account";

/** Offline account storage inside the worker: IndexedDB, one record. */
export class IdbStore implements AccountStore {
  private cache = new Map<string, Account>();
  private wall: { name: string; floor: number; cause: string; at: number }[] = [];
  private dbp: Promise<IDBDatabase>;

  constructor(name = "godwell") {
    this.dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore("accounts");
        req.result.createObjectStore("meta");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async byToken(token: string): Promise<Account | null> {
    if (this.cache.has(token)) return this.cache.get(token)!;
    const db = await this.dbp;
    const acc = await new Promise<Account | null>((resolve) => {
      const r = db.transaction("accounts").objectStore("accounts").get(token);
      r.onsuccess = () => resolve((r.result as Account) ?? null);
      r.onerror = () => resolve(null);
    });
    const wall = await new Promise<typeof this.wall>((resolve) => {
      const r = db.transaction("meta").objectStore("meta").get("memorial");
      r.onsuccess = () => resolve((r.result as typeof this.wall) ?? []);
      r.onerror = () => resolve([]);
    });
    this.wall = wall;
    if (acc) this.cache.set(token, acc);
    return acc;
  }

  save(account: Account): void {
    this.cache.set(account.token, account);
    void this.dbp.then((db) => {
      db.transaction("accounts", "readwrite").objectStore("accounts").put(structuredClone(account), account.token);
    });
  }

  memorial() {
    return this.wall;
  }

  addMemorial(entry: { name: string; floor: number; cause: string; at: number }) {
    this.wall.unshift(entry);
    this.wall.length = Math.min(this.wall.length, 40);
    void this.dbp.then((db) => db.transaction("meta", "readwrite").objectStore("meta").put(this.wall, "memorial"));
  }
}
