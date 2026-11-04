# Development

The Ode repository contains the extension application, its React interface, the Max device builder, prompts, skills, and tests. A release combines these into an installable Ableton extension plus `Ode.amxd`. There is no separate hosted backend to deploy for a local development session.

Start with [Architecture](architecture.md) if you want to follow the application before running it. This guide covers the prerequisites and commands, then maps the implementation to the folders that own it.

## Requirements and SDK packages

Use Node.js `24.16.0` or later, as required by [package.json](../package.json). Running Ode in Live also requires a compatible Live 12 Suite Beta with Extensions, Developer Mode enabled for the source-development workflow, and Max for Live. Use Max 9.2 or later on macOS for the embedded window's standard editing shortcuts, or Max 9.1 or later on Windows. The [runtime setup](getting-started.md#select-the-max-runtime-on-macos) explains how to select a newer Max when Live bundles an older version.

The project pins the Ableton Extensions SDK and CLI to `1.0.0-beta.1`. Obtain the SDK distribution through [Ableton's official SDK page](https://ableton.github.io/extensions-sdk/), then place the two archives in the repository's `vendor/` directory with these names:

```text
vendor/ableton-extensions-sdk-1.0.0-beta.1.tgz
vendor/ableton-extensions-cli-1.0.0-beta.1.tgz
```

These are local file dependencies, so installation needs the archives even when you only intend to typecheck the source. `vendor/` is ignored by Git; the repository does not supply the SDK distribution. Once the archives are in place, install the locked dependencies from the repository root:

```bash
npm ci
cp .env.example .env
```

Edit `.env` to set `ODE_LIVE_APP` to your Live application and `ODE_USER_DIR` to a local development storage folder. The [example file](../.env.example) includes macOS and Windows path guidance. `ODE_USER_DIR` stores the developer's songs and settings, so choose a persistent folder. The source launcher uses a separate temporary folder for transient files.

## Models and local settings

You can configure models through Ode's Settings after starting it. Alternatively, `.env` can hold the development inputs `META_API_KEY`, `ODE_CHAT_PROVIDER`, `ODE_CHAT_MODEL`, and `ODE_CHAT_API_KEY`. Import those values into the development storage with:

```bash
npm run settings:import
```

The importer writes persistent `settings.json` under `ODE_USER_DIR`. For Meta, use `META_API_KEY`; the alternate chat-key variable is for another supported main provider. It reports which roles are configured without printing the credentials. It does not make a provider request. [DevConfig](../src/shared/dev-config.ts) reads the local paths, while [importDevSettings](../src/shared/dev-settings.ts) validates and imports the credential choices.

The installed release uses its own host-provided storage. Importing credentials into the development folder therefore does not configure an independently installed copy of Ode. The current provider and model choices are defined in [providers.json](../src/services/providers.json), and runtime role resolution is in [ModelRoles](../src/services/model-roles.ts).

## Build and run in Live

For a first source session, package the current extension and Max device, then start the development launcher:

```bash
npm run release:package
npm run live:extension
```

Packaging builds the UI and extension and writes `release/Ode-<version>.ablx` and `release/Ode.amxd`. It targets the operating system and processor running the command. The development launcher then builds the development extension bundle and invokes Ableton's CLI against `ODE_LIVE_APP`, using `ODE_USER_DIR` as its storage.

Drag the generated `release/Ode.amxd` onto an audio track or the Main track in the Set. Keep one Ode device, then click **Open Ode**. The first packaging step supplies the device needed by the source launcher; you do not also need to install that `.ablx` to use the CLI development workflow.

For later application or prompt changes, `npm run live:extension` rebuilds the extension. If the React interface changed, run `npm run build:ui` first so the new page assets are included. If the Max patch or its embedded scripts changed, regenerate the release package and load the matching device. `npm run build` builds the UI and extension without creating the final release files.

The [extension builder](../src/live/extension/build.ts) embeds UI assets and Markdown prompts and skills into the JavaScript bundle. Skill evaluation folders are excluded. It also packages the Claude Agent SDK's executable for the current platform, which is why a release extension is platform specific. The runtime is shipped with the package rather than downloaded at application startup.

## Optional UI development server

Vite can serve the React interface during UI work, but the real Ode application still runs inside Live. This optional path requires the current authenticated local Ode URL; the proxy does not discover it automatically, and startup currently logs only “Ode is ready.” The normal build-and-launch steps above work without it. If you are inspecting a session and already have its URL, set `ODE_DEV_SERVER` in `.env` to that full URL, including the token, then run:

```bash
npx vite
```

The [Vite configuration](../vite.config.ts) forwards `/api` to the extension's local server and carries its session token. It also preserves the long-running event stream. The URL and token belong to the current extension session, so update the setting after restarting that session. A standalone Vite page does not provide a fake DAW or a replacement agent backend.

## Validation and model evaluations

The regular checks are:

```bash
npm run typecheck
npm test
```

Typechecking validates the TypeScript project. The test suite exercises application behaviour through fixtures and test doubles, including native integration boundaries, settings, lyrics, history, transport translation, and audio payload handling. Passing those checks does not establish interactive compatibility with every Live build or the musical quality of a model's decisions.

`npm run test:skills` is a separate evaluation command. It runs skill scenarios against a scaffolded Set and uses configured models for execution and grading. It needs developer settings and makes provider calls; it is not an ordinary offline check. With no skill arguments it discovers all cases, while supplied skill names narrow the run. Its report explicitly does not validate rendered audio or professional listening quality. [The scenario runner](../src/tests/skill-scenarios.ts) defines that evaluation.

To check an actual native integration, run a focused session in the supported Live beta: open the matching device, inspect a known clip, perform a small edit, and confirm its native result. If listening is involved, use a Meta configuration and verify the source stage of the captured passage. This distinguishes an application or adapter check from an observation of the real host.

Test the packaged `.ablx` as well as the source launcher. **Developer Mode on** connects Live to the external development host; **Developer Mode off** makes Live launch its installed-extension host. Requiring a Live beta does not make Developer Mode a requirement for packaged extensions. The installed host also supplies a separate persistent storage directory, so settings saved during development do not automatically configure an installed release.

The hosts can expose different runtime restrictions. During validation on Live beta 12.4.25b1, the installed host's Node Permission Model rejected `fsync` even for writable files. Ode 0.3.1 handles that restriction in its shared file-sync helper, retaining the normal writes and publication steps. The [installed-host storage tests](../src/tests/installed-host-storage.test.ts) run actual Node subprocesses with permissions enabled and check songs, private settings, audio imports, and History. Those tests complement installing the package, restarting Live, opening Ode, and verifying a real request against the Set.

Check the Max runtime separately from Live's version. Max 9.2 fixes the embedded browser's macOS Command-key handling, and Live can use an external Max application selected in File & Folder Settings. During the 9.2.1 check, the native HTTP client also omitted the port from its generated `Host` header. Ode 0.3.1's Max helper supplies the full authority explicitly; its regression test preserves the server's refusal of an incomplete header. A successful extension startup alone does not establish that the device connects or that text editing works in the embedded window.

## Finding the implementation

| Path | Responsibility |
| --- | --- |
| `src/live/extension/` | Extension startup, context menus, SDK object references, and native operations. |
| `src/live/max/` | Max device construction and the scripts for the window, audio, parameters, and controls. |
| `src/server/` | Application composition, HTTP API, event stream, request context, and recovery coordination. |
| `src/harness/` | Agent SDK integration, provider transport, tool mediation, sessions, and request limits. |
| `src/agents/` and `skills/` | Agent instructions and music-workflow guidance. |
| `src/tools/` | Model-facing operations and their input and mutation declarations. |
| `src/services/` | Provider catalogue, model roles, adapters, lyric interpretation, and audio payload preparation. |
| `src/mneme/` | Artist memory, song documents, conversations, references, and version storage. |
| `src/audio/` | Supported audio-file decoding, excerpts, metadata, and WAV encoding. |
| `src/ui/` and `src/ui-kit/` | React views, client state, and shared interface components. |
| `src/shared/` | Cross-layer types, schemas, defaults, and English interface strings. |
| `src/tests/` | Application tests, host fixtures, and the separate skill-scenario runner. |
| `src/packaging/` | Version consistency, release files, and generated release notes. |

The [main prompt](../src/agents/ode.md) describes intended agent behaviour, while tool implementations and native bridges determine what is enforced and executable. Read both when documenting a capability. For example, a skill can recommend auditioning a sound, but only an available capture route and supported model transport make that listening step possible.

## Packaging and releases

`npm run release:package` validates that the package and extension manifest versions agree, rebuilds the artifacts, and replaces the contents of `release/`. A local build produces one platform's extension. The [release workflow](../.github/workflows/release.yml) runs separate builds for Apple silicon macOS, Intel macOS, and Windows, then applies the platform suffixes used on GitHub.

The workflow obtains its SDK archives from configured private build storage before running dependency installation, typechecking, tests, and packaging. A version-tag push publishes a GitHub release after all three builds complete. A manual workflow run builds artifacts without taking that tag-publication path.

Version changes have explicit side effects: `npm version <x.y.z>` runs the preversion checks, synchronises the extension manifest, creates the release commit and tag, and invokes the configured postversion push. Use it when publishing a version, rather than as a way to inspect or test the build. For an ordinary local package, keep the existing version and run `npm run release:package`.
