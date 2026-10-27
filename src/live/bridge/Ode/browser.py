from collections import deque


TAG_SEPARATOR = " ·"


class BrowserCommands(object):
    """Search and load items from Live's browser."""

    CATEGORIES = ("instruments", "audio_effects", "midi_effects", "plugins", "drums", "sounds", "samples", "user_library")
    # Walking the whole browser (samples, User Library) can be slow; searches stop after this many items.
    MAX_VISITED = 25000
    DEFAULT_LIMIT = 50

    def __init__(self, application, song):
        self._application = application
        self._song = song
        self._found = {}

    def run(self, op, args):
        if op == "browser_search":
            return self.search(args["query"], args.get("category", "all"), args.get("limit", self.DEFAULT_LIMIT))
        if op == "browser_load":
            return self.load(args["uri"], args["track"])
        if op == "plugin_list":
            return self.plugins(args.get("limit", 500))
        raise ValueError("unknown operation: %s" % op)

    def search(self, query, category, limit):
        needle = query.lower()
        roots = self.CATEGORIES if category == "all" else (category,)
        items = []
        for root in roots:
            for item, path in self._walk(root):
                if needle in item.name.lower():
                    items.append(self._describe(item, root, path))
                    if len(items) >= limit:
                        return {"items": items}
        return {"items": items}

    def plugins(self, limit):
        found = []
        for item, path in self._walk("plugins"):
            if item.is_loadable:
                found.append(self._describe(item, "plugins", path))
                if len(found) >= limit:
                    break
        return {"plugins": found}

    def load(self, uri, track_ref):
        item = self._found.get(uri) or self._find_by_uri(uri)
        if item is None:
            raise ValueError("not found: browser item %s" % uri)
        self._song.view.selected_track = self._track(track_ref)
        self._application.browser.load_item(item)
        return {"loaded": item.name}

    def _walk(self, root):
        start = getattr(self._application.browser, root, None)
        if start is None:
            return
        pending = deque([(child, root) for child in start.children])
        visited = 0
        while pending and visited < self.MAX_VISITED:
            item, path = pending.popleft()
            visited += 1
            yield item, path
            if item.is_folder or item.children:
                for child in item.children:
                    pending.append((child, path + "/" + item.name))

    def _find_by_uri(self, uri):
        for root in self.CATEGORIES:
            for item, _path in self._walk(root):
                if item.uri == uri:
                    return item
        return None

    def _describe(self, item, category, path):
        self._found[item.uri] = item
        return {"name": item.name, "uri": item.uri, "category": category, "path": path, "isLoadable": bool(item.is_loadable)}

    def _track(self, ref):
        if "main" in ref:
            return self._song.master_track
        if "returnIndex" in ref:
            return self._song.return_tracks[ref["returnIndex"]]
        tracks = list(self._song.tracks)
        if "index" in ref:
            return tracks[ref["index"]]
        if "tag" in ref:
            suffix = TAG_SEPARATOR + ref["tag"]
            for track in tracks:
                if track.name.endswith(suffix):
                    return track
        if "name" in ref:
            for track in tracks:
                if track.name == ref["name"]:
                    return track
            for track in tracks:
                if track.name.lower() == ref["name"].lower():
                    return track
        raise ValueError("not found: track %s" % ref)
