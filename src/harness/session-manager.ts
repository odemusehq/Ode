import { z } from "zod";
import { JsonFile } from "../mneme/json-file";
import { OdeSession, type SessionDeps } from "./session";

/** One conversation per song (per Live Set), resumed when the Set is opened again. */
export class SessionManager {
  private static readonly NO_SET = "no-set";
  private readonly ids: JsonFile<Record<string, string>>;
  private session: OdeSession;
  private key = SessionManager.NO_SET;

  constructor(
    private readonly deps: SessionDeps,
    idsPath: string,
  ) {
    this.ids = new JsonFile(idsPath, z.record(z.string(), z.string()), () => ({}));
    this.session = this.create(null, this.key);
  }

  get current(): OdeSession {
    return this.session;
  }

  /**
   * Switches to the conversation of another Set. With carryOver (the same Set, saved for the first time or under a
   * new name) the current conversation continues under the Set's new key.
   */
  async switchTo(setId: string, carryOver = false): Promise<void> {
    if (setId === this.key) return;
    if (carryOver) {
      const previous = this.key;
      this.key = setId;
      this.session.rekey((id) => void this.ids.update((saved) => ({ ...saved, [setId]: id })));
      const id = this.session.id;
      if (id) await this.ids.update(({ [previous]: _dropped, ...saved }) => ({ ...saved, [setId]: id }));
      return;
    }
    this.session.stop();
    const ids = await this.ids.read();
    this.key = setId;
    this.session = this.create(ids[setId] ?? null, setId);
  }

  private create(resumeId: string | null, key: string): OdeSession {
    return new OdeSession(this.deps, resumeId, (id) => {
      void this.ids.update((saved) => ({ ...saved, [key]: id }));
    });
  }
}
