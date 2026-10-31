import type { Role, RoleConfig } from "../shared/config";
import { t } from "../shared/i18n";

/** Whether a role can be used, and what the musician sets in Ode: Settings to make it work. */
export class RoleCheck {
  /** Configuration names the provider, model, endpoint and local key; actual provider access is checked on use. */
  static isConfigured(role: RoleConfig): boolean {
    return Boolean(role.provider && role.baseUrl && role.model && role.apiKey);
  }

  /** What the musician sets in Ode: Settings to make a role work. */
  static setupMessage(role: Role): string {
    switch (role) {
      case "main":
      case "subagent":
        return t("modelServices.setup.agent");
      case "transcription":
        return t("modelServices.setup.transcription");
      case "lyrics_check":
        return t("modelServices.setup.lyricist");
    }
  }
}
