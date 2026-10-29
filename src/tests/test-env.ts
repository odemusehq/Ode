import { join } from "node:path";

/** A complete set of the machine settings Ode reads from .env, for tests, independent of the developer's .env. */
export function testEnv(userDir: string): NodeJS.ProcessEnv {
  return {
    ODE_HOST: "127.0.0.1",
    ODE_PORT: "8747",
    ODE_BRIDGE_PORT: "9878",
    ODE_USER_DIR: userDir,
    ODE_LIVE_APP: join(userDir, "Live.app"),
    ODE_ABLETON_USER_LIBRARY_MACOS: join(userDir, "User Library"),
    ODE_ABLETON_USER_LIBRARY_WINDOWS: join(userDir, "User Library"),
  };
}
