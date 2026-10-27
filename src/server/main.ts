import { ConfigError, OdeConfig } from "../shared/config";
import { OdeApp } from "./app";

try {
  const config = OdeConfig.load();
  new OdeApp(config).start();
  console.log(`Ode is running at ${config.serverUrl}`);
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}
