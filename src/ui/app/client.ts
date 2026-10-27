import { API } from "../../shared/api";
import type { LeadSheet } from "../../shared/song";
import { ApprovalStatus } from "../../ui-kit";
import { OdeApi, errorMessage } from "./api";
import { EventStream } from "./events";
import type { Decision } from "./model";
import { Store } from "./state";
import { ViewId } from "./views";

/** Ode as the UI sees it: the server's API, its event stream and the state they feed. */
export class OdeClient {
  readonly store = new Store();
  readonly api = new OdeApi();
  private readonly stream: EventStream;

  constructor() {
    this.stream = new EventStream(API.events, {
      onEvent: (event) => this.store.apply(event),
      onState: (state) => this.store.setStream(state),
      onOpen: () => void this.refresh(),
    });
  }

  start(): void {
    this.stream.start();
  }

  stop(): void {
    this.stream.stop();
  }

  /** Fetches the Live status and the lead sheet again. */
  async refresh(): Promise<void> {
    const [status, song] = await Promise.allSettled([this.api.getStatus(), this.api.getSong()]);
    if (status.status === "fulfilled") this.store.setStatus(status.value);
    if (song.status === "fulfilled") this.store.setSong(song.value);
  }

  async send(text: string): Promise<void> {
    const message = text.trim();
    if (!message) return;
    this.store.addLocalMessage(message);
    try {
      await this.api.chat({ text: message });
    } catch (error) {
      this.store.addError(`Your message didn't reach Ode: ${errorMessage(error)}`);
    }
  }

  /** Sends a request from another page and shows the chat, where the answer arrives. */
  async ask(text: string): Promise<void> {
    this.store.setView(ViewId.Chat);
    await this.send(text);
  }

  async stopRequest(): Promise<void> {
    try {
      await this.api.stop();
    } catch (error) {
      this.store.addError(`Ode couldn't stop: ${errorMessage(error)}`);
    }
  }

  async decide(id: string, decision: Decision, always = false): Promise<void> {
    this.store.setApprovalStatus(id, decisionStatus(decision, always));
    try {
      await this.api.decide(id, { decision, always });
    } catch (error) {
      this.store.setApprovalStatus(id, ApprovalStatus.Pending);
      this.store.addError(`Your decision didn't reach Ode: ${errorMessage(error)}`);
    }
  }

  async saveSong(leadSheet: LeadSheet): Promise<LeadSheet> {
    const saved = await this.api.saveSong(leadSheet);
    this.store.setSong(saved);
    return saved;
  }
}

function decisionStatus(decision: Decision, always: boolean): ApprovalStatus {
  if (decision === "deny") return ApprovalStatus.Denied;
  return always ? ApprovalStatus.AlwaysAllowed : ApprovalStatus.Allowed;
}
