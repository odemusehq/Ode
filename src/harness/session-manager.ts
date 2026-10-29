import type { ConversationStore } from "../mneme/conversations";
import { OdeSession, SessionBusyError, type SessionDeps } from "./session";

/** One conversation per song, carried on whenever the musician comes back to it. */
export class SessionManager {
  private static readonly NO_SONG = "no-song";
  private session: OdeSession;
  private key = SessionManager.NO_SONG;

  constructor(
    private readonly deps: SessionDeps,
    private readonly conversations: ConversationStore,
  ) {
    this.session = new OdeSession(deps, conversations.log(this.key), this.key);
  }

  get current(): OdeSession {
    return this.session;
  }

  /** Switches to the conversation of another song. */
  switchTo(songId: string): void {
    if (songId === this.key) return;
    if (this.session.isBusy) throw new SessionBusyError("Ode is still working on this song.");
    this.key = songId;
    this.session.retire();
    this.session = new OdeSession(this.deps, this.conversations.log(songId), songId);
  }
}
