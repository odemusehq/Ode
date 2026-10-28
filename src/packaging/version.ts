import { Release } from "./release";

// npm runs this (the "version" script) after it writes the new version to package.json and before it commits.
await (await Release.read()).writeManifest();
