import { access, chmod, copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { t } from "../shared/i18n";

/** The official SDK's platform executable, shipped alongside the extension bundle. */
export class AgentRuntime {
  static readonly target = `${process.platform}-${process.arch}`;
  static readonly executable = process.platform === "win32" ? "claude.exe" : "claude";

  static async path(): Promise<string> {
    const here = typeof __filename === "string" ? __filename : fileURLToPath(import.meta.url);
    const bundled = join(dirname(here), "agent-runtime", AgentRuntime.target, AgentRuntime.executable);
    try { await access(bundled); return bundled; } catch { /* Running from source uses npm's platform package. */ }
    try { return createRequire(here).resolve(`@anthropic-ai/claude-agent-sdk-${AgentRuntime.target}/${AgentRuntime.executable}`); }
    catch { throw new Error(t("runtime.sdkRuntimeMissing", { platform: AgentRuntime.target })); }
  }

  /** Packages are platform-specific; never download an executable at application startup. */
  static async bundle(destination: string): Promise<void> {
    const folder = join(destination, "agent-runtime", AgentRuntime.target);
    await mkdir(folder, { recursive: true });
    const file = join(folder, AgentRuntime.executable);
    await copyFile(await AgentRuntime.path(), file);
    await chmod(file, 0o755);
    const require = createRequire(import.meta.url);
    const sdk = dirname(require.resolve("@anthropic-ai/claude-agent-sdk"));
    await copyFile(join(sdk, "LICENSE.md"), join(folder, "LICENSE.md"));
  }
}
