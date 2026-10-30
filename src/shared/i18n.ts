import { createInstance, type ParseKeys } from "i18next";
import ICU from "i18next-icu";
import en from "./locales/en.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    returnNull: false;
    enableSelector: false;
    strictKeyChecks: true;
    resources: { translation: typeof en };
  }
}

/** Shared by the UI and extension. All fixed product copy lives in the language catalogue. */
const i18n = createInstance();
void i18n.use(ICU).init({
  lng: "en",
  fallbackLng: "en",
  supportedLngs: ["en"],
  resources: { en: { translation: en } },
  initAsync: false,
  returnNull: false,
  interpolation: { escapeValue: false },
});

export type MessageKey = ParseKeys;

export const t = i18n.t.bind(i18n);

/** Max's embedded JavaScript receives the same catalogue through its existing device build. */
export const nativeStrings = { max: en.max, maxAudio: en.maxAudio };
