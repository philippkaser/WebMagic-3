/** A typed, id-keyed table of definitions. Content modules register their
 * defs at import time; engine code looks them up by id. `index()` gives a
 * small stable integer per id (sorted order) used by the binary net codec —
 * identical on client and server because both import the same content. */
export class Registry<T extends { id: string }> {
  private map = new Map<string, T>();
  private sorted: string[] | null = null;
  private indices: Map<string, number> | null = null;

  constructor(readonly kind: string) {}

  register(...defs: T[]): void {
    for (const d of defs) {
      if (this.map.has(d.id)) throw new Error(`duplicate ${this.kind} id "${d.id}"`);
      this.map.set(d.id, d);
    }
    this.sorted = null;
    this.indices = null;
  }

  get(id: string): T {
    const d = this.map.get(id);
    if (!d) throw new Error(`unknown ${this.kind} "${id}"`);
    return d;
  }

  find(id: string): T | undefined {
    return this.map.get(id);
  }

  has(id: string): boolean {
    return this.map.has(id);
  }

  all(): T[] {
    return [...this.map.values()];
  }

  get size(): number {
    return this.map.size;
  }

  /** Stable small integer for an id (for the wire). */
  index(id: string): number {
    this.ensureIndex();
    const i = this.indices!.get(id);
    if (i === undefined) throw new Error(`unknown ${this.kind} "${id}"`);
    return i;
  }

  /** Inverse of index(). */
  idAt(index: number): string {
    this.ensureIndex();
    return this.sorted![index];
  }

  private ensureIndex(): void {
    if (this.sorted) return;
    this.sorted = [...this.map.keys()].sort();
    this.indices = new Map(this.sorted.map((id, i) => [id, i]));
  }
}
