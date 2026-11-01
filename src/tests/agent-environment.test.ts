import assert from "node:assert/strict";
import { test } from "node:test";
import { AgentEnvironment } from "../harness/agent-environment";

test("the SDK uses each provider's Messages host and only the selected credential", () => {
  for (const [provider, host] of [["meta", "https://api.meta.ai"], ["baseten", "https://inference.baseten.co"], ["modal", "https://inference.us-west.modal.direct"]]) {
    const role = { provider: provider!, baseUrl: `${host}/v1`, apiKey: "selected-key", model: "selected-model", conversationHeader: "Modal-Routing-Affinity-Key" };
    const env = new AgentEnvironment(role, "/private/ode-agent").build("song-1", { PATH: "/usr/bin", HOME: "/home/user", ANTHROPIC_API_KEY: "other-key", CLAUDE_CODE_OAUTH_TOKEN: "personal-login", AWS_SECRET_ACCESS_KEY: "other-secret", ANTHROPIC_BASE_URL: "https://wrong.example" });
    assert.equal(env.ANTHROPIC_BASE_URL, host);
    assert.equal(env.ANTHROPIC_AUTH_TOKEN, "selected-key");
    assert.equal(env.ANTHROPIC_API_KEY, undefined);
    assert.equal(env.CLAUDE_CODE_OAUTH_TOKEN, undefined);
    assert.equal(env.AWS_SECRET_ACCESS_KEY, undefined);
    assert.equal(env.ANTHROPIC_DEFAULT_HAIKU_MODEL, "selected-model");
    assert.equal(env.CLAUDE_CODE_SUBAGENT_MODEL, "selected-model");
    assert.equal(env.CLAUDE_CONFIG_DIR, "/private/ode-agent");
    assert.equal(env.ENABLE_TOOL_SEARCH, "false");
    assert.match(env.ANTHROPIC_CUSTOM_HEADERS!, /Modal-Routing-Affinity-Key: song-1/);
  }
});

test("an unknown provider or a redirected credential fails without choosing another backend", () => {
  const role = { provider: "meta", baseUrl: "https://wrong.example/v1", apiKey: "private-key", model: "muse-spark-1.3" };
  assert.throws(() => new AgentEnvironment(role, "/private/sdk").build("song"), /Messages/);
  assert.throws(() => new AgentEnvironment({ ...role, provider: "unknown" }, "/private/sdk").build("song"), /Messages/);
});
