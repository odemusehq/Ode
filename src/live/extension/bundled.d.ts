/** Ode's text files (agent prompts and skills) by repo path, bundled into the extension at build time. */
declare module "ode:texts" {
  const files: Readonly<Record<string, string>>;
  export default files;
}

/** The built UI's files by path (index.html, assets/…), base64-encoded, bundled into the extension at build time. */
declare module "ode:ui" {
  const files: Readonly<Record<string, string>>;
  export default files;
}
