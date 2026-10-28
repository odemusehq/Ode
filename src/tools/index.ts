import { createSdkMcpServer, tool, type McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";
import type { AnyTool, ToolContext } from "./define";
import { liveTools } from "./live";
import { deviceTools } from "./device";
import { browserTools } from "./browser";
import { musicTools } from "./music";
import { audioTools } from "./audio";
import { mediaTools } from "./media";
import { songTools } from "./song";

export enum ToolServer {
  Live = "ode-live",
  Device = "ode-device",
  Browser = "ode-browser",
  Music = "ode-music",
  Audio = "ode-audio",
  Media = "ode-media",
  Song = "ode-song",
}

const GROUPS: ReadonlyArray<readonly [ToolServer, readonly AnyTool[]]> = [
  [ToolServer.Live, liveTools],
  [ToolServer.Device, deviceTools],
  [ToolServer.Browser, browserTools],
  [ToolServer.Music, musicTools],
  [ToolServer.Audio, audioTools],
  [ToolServer.Media, mediaTools],
  [ToolServer.Song, songTools],
];

/** Every Ode tool, served to the agent runtime as in-process MCP servers. */
export class ToolRegistry {
  private readonly byFullName = new Map<string, AnyTool>();

  constructor(private readonly ctx: ToolContext) {
    for (const [server, tools] of GROUPS) {
      for (const definition of tools) this.byFullName.set(ToolRegistry.fullName(server, definition.name), definition);
    }
  }

  static fullName(server: ToolServer, name: string): string {
    return `mcp__${server}__${name}`;
  }

  mcpServers(): Record<string, McpSdkServerConfigWithInstance> {
    return Object.fromEntries(
      GROUPS.map(([server, tools]) => [server, createSdkMcpServer({ name: server, tools: tools.map((definition) => this.wrap(definition)) })]),
    );
  }

  find(fullName: string): AnyTool | undefined {
    return this.byFullName.get(fullName);
  }

  /** Subagents get every tool except those that change the Set or Mneme and those only the main agent uses. */
  namesFor(agent: "main" | "subagent"): string[] {
    return [...this.byFullName]
      .filter(([, definition]) => agent === "main" || (definition.changes === "none" && !definition.mainAgentOnly))
      .map(([name]) => name);
  }

  /** Tools that run without asking: those that change nothing. */
  readOnlyNames(): string[] {
    return [...this.byFullName].filter(([, definition]) => definition.changes === "none").map(([name]) => name);
  }

  private wrap(definition: AnyTool) {
    return tool(
      definition.name,
      definition.description,
      definition.input,
      async (args) => {
        try {
          const result = await definition.run(args, this.ctx);
          return { content: [{ type: "text" as const, text: JSON.stringify(result ?? { done: true }) }] };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { content: [{ type: "text" as const, text: message }], isError: true };
        }
      },
      { alwaysLoad: definition.alwaysLoad ?? false },
    );
  }
}
