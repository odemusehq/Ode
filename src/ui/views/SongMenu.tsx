import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { SongsResponse } from "../../shared/api";
import { Button, ButtonVariant, Select, TextInput } from "../../ui-kit";
import { errorMessage } from "../app/api";
import { useAppState, useClient } from "../app/hooks";

/** The menu's entry that starts a new song. */
const NEW_SONG = "new";
const UNTITLED = "Untitled song";

/** Which song Ode is working on, with every other song and a new one a click away. */
export function SongMenu() {
  const client = useClient();
  const busy = useAppState((state) => state.busy);
  const title = useAppState((state) => state.title);
  const [songs, setSongs] = useState<SongsResponse | null>(null);
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    try {
      setSongs(await client.songs());
    } catch (error) {
      client.store.setError(`The song list ran into a problem: ${errorMessage(error)}`);
    }
  }, [client]);

  // The list follows the title: a song switched or renamed elsewhere shows here too.
  useEffect(() => {
    void load();
  }, [load, title]);

  const choose = async (id: string) => {
    if (id === NEW_SONG) {
      setDraft("");
      setNaming(true);
      return;
    }
    try {
      await client.openSong(id);
      await load();
    } catch (error) {
      client.store.setError(`Ode stayed on this song: ${errorMessage(error)}`);
    }
  };

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await client.createSong(draft);
      setNaming(false);
      await load();
    } catch (error) {
      client.store.setError(`Starting the new song ran into a problem: ${errorMessage(error)}`);
    }
  };

  if (naming) {
    return (
      <form className="song-menu" onSubmit={(event) => void create(event)}>
        <TextInput
          aria-label="The new song's title"
          value={draft}
          placeholder="The new song's title"
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            setNaming(false);
          }}
        />
        <Button type="submit" variant={ButtonVariant.Primary}>
          Start
        </Button>
        <Button onClick={() => setNaming(false)}>Cancel</Button>
      </form>
    );
  }

  return (
    <Select
      className="song-menu"
      aria-label="Song"
      value={songs?.current ?? ""}
      disabled={busy || !songs}
      options={[
        ...(songs?.songs ?? []).map((song) => ({ value: song.id, label: song.title || UNTITLED })),
        { value: NEW_SONG, label: "New song…" },
      ]}
      onChange={(id) => void choose(id)}
    />
  );
}
