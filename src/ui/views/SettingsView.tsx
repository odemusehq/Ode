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

const SERVICE_LABELS: Record<OptionalRole, string> = {
  stem_separation: "Stem separation",
  singing_voice: "Singing voice for demo vocals",
  sound_generation: "Sound generation",
};

/** Where Ode uses each model, shown by its (i). */
const MODEL_INFO =
  "Ode's main model. It does the work you ask for: writing and editing lyrics, chords, melodies, drums and sounds, arranging, mixing and answering your questions.";
const LYRICS_INFO =
  "The model that highlights syllables and rhymes in the Lyrics editor as you type. It marks the lyrics you write; the main model above writes and suggests them.";
const META_INFO = "Meta's own models use this key: cover art, transcribing recordings and listening to audio.";
const SERVICE_INFO: Record<OptionalRole, string> = {
  stem_separation: "Splits a recording into the sound you describe and everything else, for samples and remixes.",
  singing_voice: "Sings demo vocals in your own voice, once you agree to it.",
  sound_generation: "Makes new one-shots and textures from a description.",
};

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

/** Ode: Settings. The chat provider, its model and key, a Meta key for Meta's own models, and optional services. */
export function SettingsView() {
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
    if (LiveDialog.modal) { LiveDialog.close(result); return; }
    const url = new URL(window.location.href);
    url.searchParams.set("view", "ask");
    url.searchParams.delete("odeWindowCommand");
    window.location.assign(url.href);
  };
  const backToChat = () => { void client.navigate(Layout.Ask); };

  const dirty = Boolean(loaded && services && (
    provider !== loaded.settings.provider || model !== loaded.settings.model || key || metaKey || lyricsKey ||
    lyricsProvider !== loaded.settings.lyrics.provider || lyricsModel !== loaded.settings.lyrics.model ||
    JSON.stringify(services) !== JSON.stringify(draftsFrom(loaded))
  ));
  useEffect(() => client.beforeLeave(() => {
    if (!saving && !dirty) return true;
    setProblem(saving ? "Wait for Settings to finish saving." : "Save your settings or choose Cancel before changing views.");
    return false;
  }), [client, dirty, saving]);

  useEffect(() => {
    api.getSettings().then(
      (response) => {
        setLoaded(response);
        setProvider(response.settings.provider);
        setModel(response.settings.model);
        setLyricsProvider(response.settings.lyrics.provider);
        setLyricsModel(response.settings.lyrics.model);
        setServices(draftsFrom(response));
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
    if (!listsModels || (!key && !savedKeyApplies)) {
      setListed([]);
      return;
    }
    let active = true;
    setListed([]);
    const timer = window.setTimeout(() => {
      api.listModels({ provider, key: key || undefined }).then(
        (found) => {
          if (!active) return;
          setProblem(null);
          setListed(found);
          setModel((current) => (found.some((each) => each.id === current) ? current : (found[0]?.id ?? "")));
        },
        (error: unknown) => active && setProblem(errorMessage(error)),
      );
    }, UI_CONFIG.modelListDelayMs);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [api, provider, key, savedKeyApplies, listsModels]);

  if (!loaded || !services) {
    return (
      <div className="settings settings--reading">
        {!LiveDialog.hosted && <Button variant={ButtonVariant.Quiet} onClick={backToChat}>Back to chat</Button>}
        {problem ? <Notice tone={Tone.Danger}>{problem}</Notice> : "Reading Settings…"}
        {LiveDialog.hosted && (
          <div className="settings__actions">
            <Button variant={ButtonVariant.Secondary} onClick={() => finish(DialogResult.Cancelled)}>
              Cancel
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
    ? "Uses the key above"
    : lyricsUsesMetaKey
      ? "Uses the Meta key above"
      : lyricsKeySaved
        ? "Saved"
        : "Needed for this provider";

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
    setSaving(true);
    setProblem(null);
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
      if (LiveDialog.hosted) finish(DialogResult.Done);
      else {
        const response = { ...loaded, settings };
        setLoaded(response);
        setKey("");
        setMetaKey("");
        setLyricsKey("");
        setServices(draftsFrom(response));
        setSaved(true);
      }
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="settings"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h1 className="settings__title">Settings</h1>
      {!LiveDialog.hosted && <Button variant={ButtonVariant.Quiet} onClick={backToChat}>Back to chat</Button>}

      <label className="settings__field">
        <span className="settings__label">Provider</span>
        <Select value={provider} options={loaded.providers.map((each) => ({ value: each.id, label: each.name }))} onChange={chooseProvider} />
      </label>

      <label className="settings__field">
        <span className="settings__label">
          Model
          <InfoTip text={MODEL_INFO} />
        </span>
        <Select
          value={model}
          disabled={models.length === 0}
          options={models.length > 0 ? models.map((each) => ({ value: each.id, label: each.name })) : [{ value: "", label: "Add the key to list your models" }]}
          onChange={setModel}
        />
        {chosen?.modelHint && <span className="settings__hint">{chosen.modelHint}</span>}
      </label>

      <label className="settings__field">
        <span className="settings__label">Key</span>
        <TextInput
          type="password"
          autoComplete="off"
          value={key}
          placeholder={savedKeyApplies ? "Saved" : "Needed for this provider"}
          onChange={(event) => setKey(event.target.value.trim())}
        />
        {chosen && <span className="settings__hint">{chosen.keyHint}</span>}
      </label>

      {!chosen?.servesMetaModels && (
        <label className="settings__field">
          <span className="settings__label">
            Meta key for cover art, transcription and listening
            <InfoTip text={META_INFO} />
          </span>
          <TextInput
            type="password"
            autoComplete="off"
            value={metaKey}
            placeholder={loaded.settings.metaKeySet ? "Saved" : "Optional"}
            onChange={(event) => setMetaKey(event.target.value.trim())}
          />
        </label>
      )}

      {credit && <p className="settings__credit">{credit}</p>}

      <fieldset className="settings__service">
        <legend className="settings__label">
          Lyrics support
          <InfoTip text={LYRICS_INFO} />
        </legend>
        <label className="settings__field">
          <span className="settings__label">Provider</span>
          <Select
            value={lyricsProvider}
            options={loaded.lyricsProviders.map((each) => ({ value: each.id, label: each.name }))}
            onChange={chooseLyricsProvider}
          />
        </label>
        <label className="settings__field">
          <span className="settings__label">Model</span>
          <Select
            value={lyricsModel}
            options={(lyricsChosen?.models ?? []).map((each) => ({ value: each.id, label: each.name }))}
            onChange={setLyricsModel}
          />
        </label>
        <label className="settings__field">
          <span className="settings__label">Key</span>
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
        More services
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
                aria-label={`${SERVICE_LABELS[role]}: provider`}
                value={draft.provider}
                options={[{ value: "", label: "Off" }, ...offered.map((each) => ({ value: each.id, label: each.name }))]}
                onChange={(id) => editService(role, { provider: id, baseUrl: offered.find((each) => each.id === id)?.baseUrl ?? "" })}
              />
              {draft.provider && (
                <>
                  <TextInput
                    aria-label={`${SERVICE_LABELS[role]}: address`}
                    placeholder="Address"
                    value={draft.baseUrl}
                    onChange={(event) => editService(role, { baseUrl: event.target.value.trim() })}
                  />
                  <TextInput
                    aria-label={`${SERVICE_LABELS[role]}: model`}
                    placeholder="Model"
                    value={draft.model}
                    onChange={(event) => editService(role, { model: event.target.value.trim() })}
                  />
                  <TextInput
                    aria-label={`${SERVICE_LABELS[role]}: key`}
                    type="password"
                    autoComplete="off"
                    placeholder={draft.keySet ? "Key saved" : "Key"}
                    value={draft.apiKey}
                    onChange={(event) => editService(role, { apiKey: event.target.value.trim() })}
                  />
                </>
              )}
            </fieldset>
          );
        })}

      {problem && <Notice tone={Tone.Danger}>{problem}</Notice>}
      {saved && <Notice tone={Tone.Success}>Saved. Ode uses these settings from the next request.</Notice>}

      <div className="settings__actions">
        <Button variant={ButtonVariant.Secondary} disabled={saving} onClick={() => finish(DialogResult.Cancelled)}>
          Cancel
        </Button>
        <Button type="submit" variant={ButtonVariant.Primary} disabled={saving || !provider || !model || needsKey}>
          Save
        </Button>
      </div>
    </form>
  );
}
