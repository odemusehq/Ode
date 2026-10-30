import { resolve } from "node:path";
import { SettingsStore } from "../mneme/settings-store";
import { ModelRoles } from "../services/model-roles";
import { ProviderCatalog } from "../services/provider-catalog";
import { Provider } from "../services/providers";
import type { Role } from "./config";
import { ConfigError, DevConfig } from "./dev-config";

/** Imports developer credentials without exposing them or replacing unrelated Settings. */
export async function importDevSettings(store: SettingsStore, env: NodeJS.ProcessEnv,
  catalog: ProviderCatalog = ProviderCatalog.bundled): Promise<{ changed: boolean; configuredRoles: Role[] }> {
  const provider = env.ODE_CHAT_PROVIDER?.trim() ?? "";
  const model = env.ODE_CHAT_MODEL?.trim() ?? "";
  const metaKey = env.META_API_KEY?.trim() ?? "";
  const chatKey = env.ODE_CHAT_API_KEY?.trim() ?? "";
  if (!provider && (model || chatKey)) throw new ConfigError("Set ODE_CHAT_PROVIDER explicitly when importing a chat model or key.");
  if (provider) {
    const choice = catalog.chatProvider(provider);
    if (!choice) throw new ConfigError("ODE_CHAT_PROVIDER must name a chat provider in Ode's catalog.");
    if (!model) throw new ConfigError("Set ODE_CHAT_MODEL for the chosen chat provider.");
    if (!choice.listsModels && !choice.models.some((entry) => entry.id === model)) {
      throw new ConfigError("ODE_CHAT_MODEL must name a model offered by the chosen provider in Ode's catalog.");
    }
    if (provider === Provider.Meta && chatKey) throw new ConfigError("Use META_API_KEY for Meta; ODE_CHAT_API_KEY is for alternate chat providers.");
  }

  const current = await store.read();
  const nextProvider = provider || current.provider;
  const nextModel = provider ? model : current.model;
  const nextKey = nextProvider === Provider.Meta
    ? metaKey || (current.provider === Provider.Meta ? current.key : current.metaKey)
    : chatKey || (nextProvider === current.provider ? current.key : "");
  if (provider && !nextKey.trim()) throw new ConfigError("The chosen chat provider needs a nonempty API key, supplied in .env or already saved for that provider.");
  const next = { ...current, provider: nextProvider, model: nextModel, key: nextKey, metaKey: metaKey || current.metaKey };
  const changed = JSON.stringify(next) !== JSON.stringify(current);
  if (changed) await store.update(next);
  const roles = new ModelRoles(store, catalog).resolve(next);
  const configuredRoles = (Object.entries(roles) as [Role, (typeof roles)[Role]][])
    .filter(([, role]) => role.provider && role.baseUrl && role.model && role.apiKey)
    .map(([role]) => role);
  return { changed, configuredRoles };
}

if (import.meta.main) {
  try {
    const config = DevConfig.load();
    const result = await importDevSettings(new SettingsStore(config.userDir, ProviderCatalog.bundled), process.env);
    console.log(`${result.changed ? "Imported" : "Kept"} settings at ${resolve(config.userDir, "settings.json")}.`);
    console.log(`Configured roles: ${result.configuredRoles.join(", ") || "none"}.`);
  } catch (error) {
    console.error(error instanceof ConfigError ? error.message : "Developer settings could not be imported. Check the settings file and its permissions.");
    process.exitCode = 1;
  }
}
