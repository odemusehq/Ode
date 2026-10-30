import { t } from "../../shared/i18n";
import { useEffect, useState } from "react";
import {
  OPTIONAL_ROLES,
  type ChatModelOption,
  type OptionalRole,
  type SettingsResponse,
  type SettingsUpdate,
} from "../../shared/settings";
import { Button, ButtonVariant, InfoTip, Notice, Select, TextInput, Tone } from "../../ui-kit";
import { errorMessage } from "../app/api";
import { UI_CONFIG } from "../app/config";
import { DialogResult, LiveDialog } from "../app/dialog";
import { useClient } from "../app/hooks";
import { Layout } from "../app/layout";
import "./SettingsView.css";

const SERVICE_LABELS: Record<OptionalRole, string> = { stem_separation: t("settings.serviceLabels.stem_separation"), singing_voice: t("settings.serviceLabels.singing_voice"), sound_generation: t("settings.serviceLabels.sound_generation") };

/** Where Ode uses each model, shown by its (i). */
const MODEL_INFO = t("settings.modelInfo");
const LYRICS_INFO = t("settings.lyricsInfo");
const META_INFO = t("settings.metaInfo");
const SAVING_NOTICE = t("settings.savingNotice");
const CLOSE_NOTICE = t("settings.closeNotice");
const SERVICE_INFO: Record<OptionalRole, string> = { stem_separation: t("settings.serviceInfo.stem_separation"), singing_voice: t("settings.serviceInfo.singing_voice"), sound_generation: t("settings.serviceInfo.sound_generation") };

/** One optional service as the form edits it; a key typed here replaces the saved one. */
interface ServiceDraft {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  keySet: boolean;
}

type ServiceDrafts = Record<OptionalRole, ServiceDraft>;

function draftsFrom(response: SettingsResponse): ServiceDrafts {
  return Object.fromEntries(
    OPTIONAL_ROLES.map((role) => {
      const saved = response.settings.services[role];
      return [role, { provider: saved?.provider ?? "", baseUrl: saved?.baseUrl ?? "", model: saved?.model ?? "", apiKey: "", keySet: saved?.keySet ?? false }];
    }),
  ) as ServiceDrafts;
}

interface SettingsViewProps {
  embedded?: boolean;
  active?: boolean;
  onSaved?: () => void;
}

/** The chat provider, its model and key, a Meta key, and optional services. */
export function SettingsView({ embedded = false, active = true, onSaved }: SettingsViewProps) {
  const client = useClient();
  const { api } = client;
  const [loaded, setLoaded] = useState<SettingsResponse | null>(null);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [metaKey, setMetaKey] = useState("");
  const [lyricsProvider, setLyricsProvider] = useState("");
  const [lyricsModel, setLyricsModel] = useState("");
  const [lyricsKey, setLyricsKey] = useState("");
  const [listed, setListed] = useState<ChatModelOption[]>([]);
  const [services, setServices] = useState<ServiceDrafts | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const finish = (result: DialogResult) => {
    if (embedded) {
      void client.navigate(Layout.Ask).then(() => {
        if (!client.store.getSnapshot().sidebarOpen) document.getElementById("ode-sidebar-toggle")?.focus();
      });
      return;
    }
    if (LiveDialog.modal) { LiveDialog.close(result); return; }
    const url = new URL(window.location.href);
    url.searchParams.set("view", "ask");
    url.searchParams.delete("odeWindowCommand");
    window.location.assign(url.href);
  };
  const backToChat = () => { void client.navigate(Layout.Ask); };
  const resetDraft = (response: SettingsResponse) => {
    setProvider(response.settings.provider);
    setModel(response.settings.model);
    setLyricsProvider(response.settings.lyrics.provider);
    setLyricsModel(response.settings.lyrics.model);
    setKey("");
    setMetaKey("");
    setLyricsKey("");
    setServices(draftsFrom(response));
    const error = client.store.getSnapshot().error;
    if (error === SAVING_NOTICE || error === CLOSE_NOTICE) client.store.setError(null);
  };
  const cancel = () => {
    if (saving) return;
    if (loaded) resetDraft(loaded);
    setProblem(null);
    setSaved(false);
    finish(DialogResult.Cancelled);
  };

  const dirty = Boolean(loaded && services && (
    provider !== loaded.settings.provider || model !== loaded.settings.model || key || metaKey || lyricsKey ||
    lyricsProvider !== loaded.settings.lyrics.provider || lyricsModel !== loaded.settings.lyrics.model ||
    JSON.stringify(services) !== JSON.stringify(draftsFrom(loaded))
  ));
  useEffect(() => client.beforeLeave(() => {
    if (!saving && !dirty) return true;
    const message = saving ? SAVING_NOTICE : embedded
      ? CLOSE_NOTICE
      : t("settings.leaveNotice");
    setProblem(message);
    if (embedded && !active) client.store.setError(message);
    return false;
  }), [client, dirty, saving, embedded, active]);

  useEffect(() => {
    api.getSettings().then(
      (response) => {
        setLoaded(response);
        resetDraft(response);
      },
      (error: unknown) => setProblem(errorMessage(error)),
    );
  }, [api]);

  const chosen = loaded?.providers.find((each) => each.id === provider);
  const savedKeyApplies = loaded?.settings.provider === provider && loaded.settings.keySet;
  const listsModels = chosen?.listsModels ?? false;
  // A saved key stays with its own provider, so another provider waits for its key.
  const needsKey = !savedKeyApplies && !key;

  // Modal lists the musician's own endpoints: ask for them once a key is there, typed or saved.
  useEffect(() => {
    if (!active) return;
    if (!listsModels || (!key && !savedKeyApplies)) {
      setListed([]);
      return;
    }
    let current = true;
    setListed([]);
    const timer = window.setTimeout(() => {
      api.listModels({ provider, key: key || undefined }).then(
        (found) => {
          if (!current) return;
          setProblem(null);
          setListed(found);
          setModel((current) => (found.some((each) => each.id === current) ? current : (found[0]?.id ?? "")));
        },
        (error: unknown) => current && setProblem(errorMessage(error)),
      );
    }, UI_CONFIG.modelListDelayMs);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [api, provider, key, savedKeyApplies, listsModels, active]);

  if (!loaded || !services) {
    return (
      <div className={`settings settings--reading${embedded ? " settings--embedded" : ""}`}>
        {!embedded && !LiveDialog.hosted && <Button variant={ButtonVariant.Quiet} onClick={backToChat}>{t("settings.backToChat")}</Button>}
        {problem ? <Notice tone={Tone.Danger}>{problem}</Notice> : t("settings.reading")}
        {(embedded || LiveDialog.hosted) && (
          <div className="settings__actions">
            <Button variant={ButtonVariant.Secondary} onClick={cancel}>
              {t("common.cancel")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const models = listsModels ? listed : (chosen?.models ?? []);
  const credit = models.find((each) => each.id === model)?.credit ?? null;

  // Lyrics support takes its own key, or the key above when it runs on the same provider (or on Meta, with the Meta key).
  const lyricsChosen = loaded.lyricsProviders.find((each) => each.id === lyricsProvider);
  const metaProvider = loaded.providers.find((each) => each.servesMetaModels)?.id;
  const lyricsUsesMainKey = lyricsProvider === provider && (key !== "" || savedKeyApplies);
  const lyricsUsesMetaKey = lyricsProvider === metaProvider && !chosen?.servesMetaModels && (metaKey !== "" || loaded.settings.metaKeySet);
  const lyricsKeySaved = loaded.settings.lyrics.provider === lyricsProvider && loaded.settings.lyrics.keySet;
  const lyricsKeyPlaceholder = lyricsUsesMainKey
    ? t("settings.usesMainKey")
    : lyricsUsesMetaKey
      ? t("settings.usesMetaKey")
      : lyricsKeySaved
        ? t("settings.savedKey")
        : t("settings.keyRequired");

  const chooseProvider = (id: string) => {
    setProvider(id);
    setKey("");
    setProblem(null);
    const next = loaded.providers.find((each) => each.id === id);
    setModel(id === loaded.settings.provider ? loaded.settings.model : (next?.models[0]?.id ?? ""));
  };

  const chooseLyricsProvider = (id: string) => {
    setLyricsProvider(id);
    setLyricsKey("");
    const next = loaded.lyricsProviders.find((each) => each.id === id);
    setLyricsModel(id === loaded.settings.lyrics.provider ? loaded.settings.lyrics.model : (next?.models[0]?.id ?? ""));
  };

  /** A saved key belongs to the service's provider and address: changing either asks for the key again. */
  const editService = (role: OptionalRole, change: Partial<ServiceDraft>) => {
    const next = { ...services[role], ...change };
    if (next.provider !== services[role].provider || next.baseUrl !== services[role].baseUrl) next.apiKey = "";
    const saved = loaded.settings.services[role];
    const keySet = saved !== undefined && saved.provider === next.provider && saved.baseUrl === next.baseUrl && saved.keySet;
    setServices({ ...services, [role]: { ...next, keySet } });
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setProblem(null);
    setSaved(false);
    const update: SettingsUpdate = {
      provider,
      model,
      key: key || undefined,
      metaKey: metaKey || undefined,
      lyrics: { provider: lyricsProvider, model: lyricsModel, key: lyricsKey || undefined },
      services: Object.fromEntries(
        OPTIONAL_ROLES.filter((role) => services[role].provider).map((role) => {
          const draft = services[role];
          return [role, { provider: draft.provider, baseUrl: draft.baseUrl, model: draft.model, apiKey: draft.apiKey || undefined }];
        }),
      ),
    };
    try {
      const settings = await api.saveSettings(update);
      const response = { ...loaded, settings };
      setLoaded(response);
      resetDraft(response);
      onSaved?.();
      await client.refreshStatus().catch((error) => client.store.setError(t("settings.refreshFailed", { error: (errorMessage(error)) })));
      if (!embedded && LiveDialog.hosted) finish(DialogResult.Done);
      else setSaved(true);
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className={`settings${embedded ? " settings--embedded" : ""}`}
      aria-label={embedded ? t("common.settings") : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {!embedded && <h1 className="settings__title">{t("common.settings")}</h1>}
      {!embedded && !LiveDialog.hosted && <Button variant={ButtonVariant.Quiet} onClick={backToChat}>{t("settings.backToChat")}</Button>}

      <fieldset className="settings__fields" disabled={saving} aria-busy={saving} aria-label={t("settings.fieldsetLabel")}>
      <label className="settings__field">
        <span className="settings__label">{t("settings.provider")}</span>
        <Select value={provider} options={loaded.providers.map((each) => ({ value: each.id, label: each.name }))} onChange={chooseProvider} />
      </label>

      <label className="settings__field">
        <span className="settings__label">
          {t("settings.model")}
          <InfoTip text={MODEL_INFO} />
        </span>
        <Select
          value={model}
          disabled={models.length === 0}
          options={models.length > 0 ? models.map((each) => ({ value: each.id, label: each.name })) : [{ value: "", label: t("settings.addKeyToListModels") }]}
          onChange={setModel}
        />
        {chosen?.modelHint && <span className="settings__hint">{chosen.modelHint}</span>}
      </label>

      <label className="settings__field">
        <span className="settings__label">{t("settings.key")}</span>
        <TextInput
          type="password"
          autoComplete="off"
          value={key}
          placeholder={savedKeyApplies ? t("settings.savedKey") : t("settings.keyRequired")}
          onChange={(event) => setKey(event.target.value.trim())}
        />
        {chosen && <span className="settings__hint">{chosen.keyHint}</span>}
      </label>

      {!chosen?.servesMetaModels && (
        <label className="settings__field">
          <span className="settings__label">
            {t("settings.metaKey")}
            <InfoTip text={META_INFO} />
          </span>
          <TextInput
            type="password"
            autoComplete="off"
            value={metaKey}
            placeholder={loaded.settings.metaKeySet ? t("settings.savedKey") : t("settings.optional")}
            onChange={(event) => setMetaKey(event.target.value.trim())}
          />
        </label>
      )}

      {credit && <p className="settings__credit">{credit}</p>}

      <fieldset className="settings__service">
        <legend className="settings__label">
          {t("settings.lyricsSupport")}
          <InfoTip text={LYRICS_INFO} />
        </legend>
        <label className="settings__field">
          <span className="settings__label">{t("settings.provider")}</span>
          <Select
            value={lyricsProvider}
            options={loaded.lyricsProviders.map((each) => ({ value: each.id, label: each.name }))}
            onChange={chooseLyricsProvider}
          />
        </label>
        <label className="settings__field">
          <span className="settings__label">{t("settings.model")}</span>
          <Select
            value={lyricsModel}
            options={(lyricsChosen?.models ?? []).map((each) => ({ value: each.id, label: each.name }))}
            onChange={setLyricsModel}
          />
        </label>
        <label className="settings__field">
          <span className="settings__label">{t("settings.key")}</span>
          <TextInput
            type="password"
            autoComplete="off"
            value={lyricsKey}
            placeholder={lyricsKeyPlaceholder}
            onChange={(event) => setLyricsKey(event.target.value.trim())}
          />
          {lyricsChosen && <span className="settings__hint">{lyricsChosen.keyHint}</span>}
        </label>
      </fieldset>

      <Button variant={ButtonVariant.Quiet} aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>
        {t("settings.moreServices")}
      </Button>
      {moreOpen &&
        OPTIONAL_ROLES.map((role) => {
          const draft = services[role];
          const offered = loaded.services[role];
          return (
            <fieldset key={role} className="settings__service">
              <legend className="settings__label">
                {SERVICE_LABELS[role]}
                <InfoTip text={SERVICE_INFO[role]} />
              </legend>
              <Select
                aria-label={t("settings.serviceProvider", { service: (SERVICE_LABELS[role]) })}
                value={draft.provider}
                options={[{ value: "", label: t("settings.off") }, ...offered.map((each) => ({ value: each.id, label: each.name }))]}
                onChange={(id) => editService(role, { provider: id, baseUrl: offered.find((each) => each.id === id)?.baseUrl ?? "" })}
              />
              {draft.provider && (
                <>
                  <TextInput
                    aria-label={t("settings.serviceAddress", { service: (SERVICE_LABELS[role]) })}
                    placeholder={t("settings.address")}
                    value={draft.baseUrl}
                    onChange={(event) => editService(role, { baseUrl: event.target.value.trim() })}
                  />
                  <TextInput
                    aria-label={t("settings.serviceModel", { service: (SERVICE_LABELS[role]) })}
                    placeholder={t("settings.model")}
                    value={draft.model}
                    onChange={(event) => editService(role, { model: event.target.value.trim() })}
                  />
                  <TextInput
                    aria-label={t("settings.serviceKey", { service: (SERVICE_LABELS[role]) })}
                    type="password"
                    autoComplete="off"
                    placeholder={draft.keySet ? t("settings.keySaved") : t("settings.key")}
                    value={draft.apiKey}
                    onChange={(event) => editService(role, { apiKey: event.target.value.trim() })}
                  />
                </>
              )}
            </fieldset>
          );
        })}
      </fieldset>

      {problem && <Notice tone={Tone.Danger}>{problem}</Notice>}
      {saved && !dirty && <Notice tone={Tone.Success}>{t("settings.saved")}</Notice>}

      <div className="settings__actions">
        <Button variant={ButtonVariant.Secondary} disabled={saving} onClick={cancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" variant={ButtonVariant.Primary} disabled={saving || !provider || !model || needsKey}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
