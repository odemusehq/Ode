import * as esbuild from "esbuild";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { DevConfig } from "../../shared/dev-config";
import { AgentRuntime } from "../../harness/agent-runtime";

interface Manifest {
  readonly entry: string;
}

/** What Ableton's extensions CLI looks for beside the manifest; the bundle is CommonJS. */
const EXTENSION_PACKAGE = { name: "ode-extension", private: true, type: "commonjs" };

/** Folders whose Markdown rides inside the extension: the agents' prompts and the skills. */
const TEXT_FOLDERS = ["src/agents", "skills"];
const TEXT_EXTENSION = ".md";
/** Skill test cases stay with the repo. */
const SKILL_TESTS = `${sep}evals${sep}`;
/** Where Vite writes the built UI. */
const UI_FOLDER = join("dist", "ui");
const UI_INDEX = "index.html";

/**
 * Bundles the whole of Ode into the single file Live loads, with Ode's texts (prompts and skills) and the built UI
 * inside it as the modules "ode:texts" and "ode:ui", and writes the extension's folder around it: the manifest and
 * the package file the extensions CLI runs and packages from. The UI is built first, with npm run build:ui.
 */
export class ExtensionBuild {
  static readonly directory = import.meta.dirname;
  /** The built extension's folder. */
  static readonly outDir = join(ExtensionBuild.directory, "dist");

  constructor(private readonly production: boolean) {}

  async run(): Promise<void> {
    const manifestText = await readFile(join(ExtensionBuild.directory, "manifest.json"), "utf8");
    const manifest = JSON.parse(manifestText) as Manifest;
    const [texts, ui] = await Promise.all([ExtensionBuild.texts(), ExtensionBuild.ui()]);
    await mkdir(ExtensionBuild.outDir, { recursive: true });
    await writeFile(join(ExtensionBuild.outDir, "manifest.json"), manifestText, "utf8");
    await writeFile(join(ExtensionBuild.outDir, "package.json"), `${JSON.stringify(EXTENSION_PACKAGE, null, 2)}\n`, "utf8");
    await esbuild.build({
      entryPoints: [join(ExtensionBuild.directory, "extension.ts")],
      outfile: join(ExtensionBuild.outDir, manifest.entry),
      bundle: true,
      format: "cjs",
      platform: "node",
      target: "node24",
      define: { "import.meta.url": "odeModuleUrl" },
      banner: { js: 'const odeModuleUrl = require("node:url").pathToFileURL(__filename).href;' },
      sourcesContent: false,
      logLevel: "info",
      minify: this.production,
      sourcemap: !this.production,
      plugins: [ExtensionBuild.bundledFiles({ "ode:texts": texts, "ode:ui": ui })],
    });
    await AgentRuntime.bundle(ExtensionBuild.outDir);
  }

  /** Serves each "ode:" module as its files, by path, in JSON. */
  private static bundledFiles(modules: Readonly<Record<string, Record<string, string>>>): esbuild.Plugin {
    return {
      name: "ode-bundled-files",
      setup(build) {
        build.onResolve({ filter: /^ode:/ }, (args) => ({ path: args.path, namespace: "ode" }));
        build.onLoad({ filter: /.*/, namespace: "ode" }, (args) => ({ contents: JSON.stringify(modules[args.path] ?? {}), loader: "json" }));
      },
    };
  }

  private static async texts(): Promise<Record<string, string>> {
    const files: Record<string, string> = {};
    for (const folder of TEXT_FOLDERS) {
      for (const path of await ExtensionBuild.files(join(DevConfig.repoDir, folder))) {
        const inRepo = relative(DevConfig.repoDir, path);
        if (!path.endsWith(TEXT_EXTENSION) || `${sep}${inRepo}`.includes(SKILL_TESTS)) continue;
        files[inRepo.split(sep).join("/")] = await readFile(path, "utf8");
      }
    }
    return files;
  }

  private static async ui(): Promise<Record<string, string>> {
    const root = join(DevConfig.repoDir, UI_FOLDER);
    const files: Record<string, string> = {};
    for (const path of await ExtensionBuild.files(root).catch(() => [])) {
      files[relative(root, path).split(sep).join("/")] = (await readFile(path)).toString("base64");
    }
    if (!files[UI_INDEX]) throw new Error("The UI is built first: npm run build:ui");
    return files;
  }

  private static async files(folder: string): Promise<string[]> {
    const entries = await readdir(folder, { recursive: true, withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name));
  }
}

if (import.meta.main) {
  await new ExtensionBuild(process.argv.includes("--production")).run();
}
