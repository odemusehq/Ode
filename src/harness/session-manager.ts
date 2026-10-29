import type { ConversationStore } from "../mneme/conversations";
import { OdeSession, type SessionDeps } from "./session";

/** One conversation per song (per Live Set), carried on when the Set is opened again. */
export class SessionManager {
  private static readonly NO_SET = "no-set";
  private session: OdeSession;
  private key = SessionManager.NO_SET;

  constructor(
    private readonly deps: SessionDeps,
    private readonly conversations: ConversationStore,
  ) {
    this.session = new OdeSession(deps, conversations.log(this.key));
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
    const previous = this.key;
    this.key = setId;
    if (carryOver) {
      this.session.continueIn(await this.conversations.rename(previous, setId));
      return;
    }
    this.session.stop();
    this.session = new OdeSession(this.deps, this.conversations.log(setId));
  }
}
