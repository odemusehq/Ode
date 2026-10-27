import type { OdeConfig } from "../shared/config";
import { Provider } from "../services/providers";

/** Environment for the agent runtime: which endpoint and models to use, and subagent limits. */
export class AgentEnvironment {
  constructor(private readonly config: OdeConfig) {}

  build(): Record<string, string> {
    const { main, subagent } = this.config.roles;
    const inherited = Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
    delete inherited.ANTHROPIC_API_KEY;
    delete inherited.ANTHROPIC_AUTH_TOKEN;
    // Anthropic's own API takes an API key header; other Anthropic-compatible endpoints take a bearer token.
    const credential =
      main.provider === Provider.Anthropic ? { ANTHROPIC_API_KEY: main.apiKey } : { ANTHROPIC_AUTH_TOKEN: main.apiKey };
    return {
      ...inherited,
      ...credential,
      ANTHROPIC_BASE_URL: main.baseUrl,
      ANTHROPIC_MODEL: main.model,
      ANTHROPIC_DEFAULT_OPUS_MODEL: main.model,
      ANTHROPIC_DEFAULT_SONNET_MODEL: subagent.model,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: subagent.model,
      CLAUDE_CODE_SUBAGENT_MODEL: subagent.model,
      CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS: "1",
      CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: String(this.config.limits.subagentDepth),
      CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS: String(this.config.limits.subagentsAtOnce),
      CLAUDE_AGENT_SDK_CLIENT_APP: "ode",
    };
  }
}
