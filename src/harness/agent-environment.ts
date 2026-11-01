import { createHash } from "node:crypto";
import type { RoleConfig } from "../shared/config";
import { RoleCheck } from "../services/roles";
import { t } from "../shared/i18n";

/** Documented Anthropic Messages gateways, not a Chat Completions compatibility layer. */
const HOSTS: Readonly<Record<string, string>> = {
  meta: "https://api.meta.ai",
  baseten: "https://inference.baseten.co",
  modal: "https://inference.us-west.modal.direct",
};

/** Only Ode's selected provider and credentials reach the SDK child process. */
export class AgentEnvironment {
  constructor(readonly role: RoleConfig, private readonly configDir: string) {}

  /** A session cannot resume under a different model, endpoint or credential. No key is persisted here. */
  get identity(): string {
    return createHash("sha256").update(JSON.stringify(this.role)).digest("hex");
  }

  build(conversation: string, inherited: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    if (!RoleCheck.isConfigured(this.role)) throw new Error(RoleCheck.setupMessage("main"));
    const host = HOSTS[this.role.provider];
    if (!host || this.role.baseUrl.replace(/\/+$/, "") !== `${host}/v1`) {
      throw new Error(t("runtime.sdkMessagesUnavailable", { provider: this.role.provider }));
    }
    const env: NodeJS.ProcessEnv = {};
    for (const name of ["PATH", "HOME", "USERPROFILE", "SystemRoot", "WINDIR", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL"]) {
      if (inherited[name]) env[name] = inherited[name];
    }
    Object.assign(env, {
      CLAUDE_CONFIG_DIR: this.configDir,
      ANTHROPIC_BASE_URL: host,
      ANTHROPIC_AUTH_TOKEN: this.role.apiKey,
      ANTHROPIC_MODEL: this.role.model,
      ANTHROPIC_DEFAULT_FABLE_MODEL: this.role.model,
      ANTHROPIC_DEFAULT_OPUS_MODEL: this.role.model,
      ANTHROPIC_DEFAULT_SONNET_MODEL: this.role.model,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: this.role.model,
      CLAUDE_CODE_SUBAGENT_MODEL: this.role.model,
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
      CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS: "1",
      CLAUDE_AGENT_SDK_CLIENT_APP: "ode",
      // Meta's tested gateway did not resolve Anthropic tool_reference blocks for Spark.
      // Start gateways in documented non-deferred mode until their model's discovery is verified.
      ENABLE_TOOL_SEARCH: "false",
    });
    if (this.role.conversationHeader) {
      if (!/^[A-Za-z0-9-]+$/.test(this.role.conversationHeader) || /[\r\n]/.test(conversation)) throw new Error("Invalid conversation routing header.");
      env.ANTHROPIC_CUSTOM_HEADERS = `${this.role.conversationHeader}: ${conversation}`;
    }
    return env;
  }
}
