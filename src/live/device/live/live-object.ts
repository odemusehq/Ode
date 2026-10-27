/** A thin, typed view of one object in Live, through the Max for Live API (LiveAPI). */
export class LiveObject {
  private readonly api: LiveAPI;

  constructor(readonly path: string) {
    this.api = new LiveAPI(path);
    if (Number(this.api.id) === 0) throw new Error(`not found: ${path}`);
  }

  get id(): number {
    return Number(this.api.id);
  }

  number(property: string): number {
    return Number(this.api.get(property)[0]);
  }

  bool(property: string): boolean {
    return this.number(property) === 1;
  }

  text(property: string): string {
    return this.api.get(property).join(" ");
  }

  /** Ids of a list property such as "tracks" (LiveAPI returns ["id", 1, "id", 2, …]). */
  ids(property: string): number[] {
    const raw = this.api.get(property);
    const ids: number[] = [];
    for (let i = 0; i < raw.length; i += 2) if (raw[i] === "id") ids.push(Number(raw[i + 1]));
    return ids;
  }

  set(property: string, value: unknown): void {
    this.api.set(property, value);
  }

  call(name: string, ...args: unknown[]): unknown {
    return this.api.call(name, ...args);
  }

  count(child: string): number {
    return this.api.getcount(child);
  }

  child(child: string, index: number): LiveObject {
    return new LiveObject(`${this.path} ${child} ${index}`);
  }
}
