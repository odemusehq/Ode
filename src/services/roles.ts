import type { Role, RoleConfig } from "../shared/config";
import { Provider } from "./providers";

/** Whether a role can be used, and what the musician sets in Ode: Settings to make it work. */
export class RoleCheck {
  /** A role is usable once it has a provider, an endpoint and a key; a self-hosted server needs the endpoint alone. */
  static isConfigured(role: RoleConfig): boolean {
    return Boolean(role.provider && role.baseUrl && (role.apiKey || role.provider === Provider.SelfHosted));
  }

  /** What the musician sets in Ode: Settings to make a role work. */
  static setupMessage(role: Role): string {
    switch (role) {
      case "main":
      case "subagent":
        return "Choose a provider and model, and add its key, in Ode: Settings";
      case "audio_understanding":
      case "transcription":
      case "image_generation":
        return "This uses Meta's models: add a Meta key in Ode: Settings";
      default:
        return `Add a ${role.replace("_", " ")} service in Ode: Settings, under More services`;
    }
  }
}
