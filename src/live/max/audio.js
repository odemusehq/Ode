/* Embedded Max 9.1 capture. Only the extension writes files; audio travels as bounded JSON PCM. */
var odeAudio = { rate: 0, dsp: false, beat: null, sample: null, flags: 0, bufferName: "", catalogue: null, serial: 0, job: null, done: [] };

function ode_audio_rate(value) { odeAudio.rate = Number(value); }
function ode_audio_dsp(value) { odeAudio.dsp = Number(value) === 1; }
function ode_audio_beat(value) { odeAudio.beat = Number.isFinite(Number(value)) ? Number(value) : null; }
function ode_audio_sample(value) { odeAudio.sample = Number.isFinite(Number(value)) ? Number(value) : null; }
function ode_audio_flags(value) { odeAudio.flags = Number(value); }
function ode_audio_buffer(name) { odeAudio.bufferName = String(name); }
function ode_audio_scalar(value) { return Array.isArray(value) && value.length === 1 ? ode_audio_scalar(value[0]) : value; }
function ode_audio_get(api, key) { return ode_audio_scalar(api.get(key)); }
function ode_audio_ids(value) {
  var found = [];
  function add(item) {
    if (Array.isArray(item)) { for (var i = 0; i < item.length; i++) add(item[i]); }
    else if ((typeof item === "number" || /^\d+$/.test(String(item))) && Number(item) > 0) found.push(Number(item));
  }
  add(value); return found;
}
function ode_audio_dictionary(value) {
  if (value && !Array.isArray(value) && typeof value === "object") return value;
  if (Array.isArray(value) && value[0] === "dictionary") return JSON.parse(new Dict(String(value[1])).stringify());
  value = ode_audio_scalar(value);
  if (typeof value === "string") {
    if (value.indexOf("dictionary ") === 0) return JSON.parse(new Dict(value.slice(11)).stringify());
    return JSON.parse(value);
  }
  throw new Error("Live did not expose its routing dictionary.");
}
function ode_audio_routing(api, key) { return ode_audio_dictionary(api.get(key)); }
function ode_audio_set_routing(api, key, value) { api.set(key, JSON.stringify(value)); }
function ode_audio_send(message, callback) {
  if (!running || !session) return;
  http(ODE_AUDIO.messagePath, { session: session, message: message }, function (response, code) {
    if (callback) callback(code === 200, response);
  });
}
function ode_audio_remember(id) {
  odeAudio.done.push(id);
  if (odeAudio.done.length > 16) odeAudio.done.shift();
}
function ode_audio_object(name, value) { odePatcher.getnamed(name).message(value); }
function ode_audio_task(fn, delay) { var task = new Task(fn, this); task.schedule(delay); return task; }

function ode_audio_host() {
  var device = new LiveAPI(null, "this_device");
  var current = device;
  var trackName = "Unknown host track";
  for (var depth = 0; depth < 12; depth++) {
    var ids = ode_audio_ids(current.get("canonical_parent"));
    if (!ids.length) break;
    current = new LiveAPI(null, "id " + ids[0]);
    if (current.type === "Track") { trackName = String(ode_audio_get(current, "name")); break; }
  }
  return { trackName: trackName, deviceName: String(ode_audio_get(device, "name")) };
}
function ode_audio_host_identity() {
  var current = new LiveAPI(null, "this_device");
  var identity = [String(current.id)];
  for (var depth = 0; depth < 12; depth++) {
    var ids = ode_audio_ids(current.get("canonical_parent"));
    if (!ids.length) break;
    var parent = new LiveAPI(null, "id " + ids[0]);
    identity.push(String(ids[0]));
    if (parent.type === "Track" || parent.type === "Chain") identity.push(ode_audio_ids(parent.get("devices")).join(","));
    if (parent.type === "Track") break;
    current = parent;
  }
  return identity.join("/");
}
function ode_audio_tracks() {
  var song = new LiveAPI(null, "live_set");
  var tracks = [];
  function append(list, kind) {
    ode_audio_ids(list).forEach(function (id) {
      var api = new LiveAPI(null, "id " + id);
      tracks.push({ name: String(ode_audio_get(api, "name")), kind: kind === "track" && Number(ode_audio_get(api, "is_foldable")) ? "group" : kind });
    });
  }
  append(song.get("tracks"), "track");
  append(song.get("return_tracks"), "return");
  var main = new LiveAPI(null, "live_set master_track");
  tracks.push({ name: String(ode_audio_get(main, "name")), kind: "main" });
  return tracks;
}
function ode_audio_sources(id) {
  if (odeAudio.job) throw new Error("Wait for the current audio capture to finish.");
  var host = ode_audio_host();
  var catalogue = { catalogueId: "catalogue-" + Date.now() + "-" + (++odeAudio.serial), host: host, hostIdentity: ode_audio_host_identity(), sources: [], targets: {} };
  function add(source, target) {
    if (catalogue.sources.length >= ODE_AUDIO.maxSources) return;
    source.id = catalogue.catalogueId + ":" + catalogue.sources.length;
    catalogue.sources.push(source); catalogue.targets[source.id] = target;
  }
  add({ name: host.trackName + " · at Ode's insertion point", kind: "device", stage: "device-input", trackName: host.trackName }, { local: true });
  var device = new LiveAPI(null, "this_device");
  var buses = ode_audio_ids(device.get("audio_inputs"));
  // Audio inputs 1/2 remain the device chain. Additional bus 1 is reserved for capture, never output.
  if (buses.length > 1) {
    var bus = new LiveAPI(null, "id " + buses[1]);
    var originalType = ode_audio_routing(bus, "routing_type");
    var originalChannel = ode_audio_routing(bus, "routing_channel");
    var tracks = ode_audio_tracks();
    try {
      var types = ode_audio_routing(bus, "available_routing_types").available_routing_types || [];
      // Max 9.1's routing JSON loses the backslash in Ode's escaped middle-dot separator.
      // Project only that observed spelling, retaining native names and refusing collisions in either direction.
      var matches = types.map(function (type) {
        return tracks.filter(function (track) { return track.name === type.display_name || track.name.replace(/\u00b7/g, "u00b7") === type.display_name || track.kind === "main" && /^(Main|Master)$/.test(type.display_name); });
      });
      types.forEach(function (type, routeIndex) {
        var candidates = matches[routeIndex];
        if (candidates.length !== 1) return;
        if (matches.filter(function (other) { return other.indexOf(candidates[0]) !== -1; }).length !== 1) return;
        ode_audio_set_routing(bus, "routing_type", type);
        var channels = ode_audio_routing(bus, "available_routing_channels").available_routing_channels || [];
        channels.forEach(function (channel) {
          var label = String(channel.display_name).toLowerCase().replace(/\s+/g, " ");
          var stage = label === "post fx" ? "post-fx" : label === "post mixer" ? "post-mixer" : null;
          if (!stage || !type.identifier || !channel.identifier) return;
          add({ name: candidates[0].name + " · " + channel.display_name, kind: candidates[0].kind, stage: stage, trackName: candidates[0].name },
            { busId: buses[1], type: type, channel: channel });
        });
      });
    } finally {
      ode_audio_set_routing(bus, "routing_type", originalType);
      ode_audio_set_routing(bus, "routing_channel", originalChannel);
    }
  }
  odeAudio.catalogue = catalogue;
  ode_audio_remember(id);
  ode_audio_send({ kind: "sources", id: id, catalogueId: catalogue.catalogueId, host: host, sources: catalogue.sources });
}

function ode_audio_restore(job) {
  releaseTask(job.finishTask); releaseTask(job.uploadTask); releaseTask(job.monitorTask);
  try { ode_audio_object("odeCaptureRecorder", 0); } catch (_) {}
  if (job.bus && job.previousRouting) {
    try {
      var currentType = ode_audio_routing(job.bus, "routing_type");
      var currentChannel = ode_audio_routing(job.bus, "routing_channel");
      if (currentType.identifier === job.target.type.identifier && (!job.channelSet || currentChannel.identifier === job.target.channel.identifier)) {
        ode_audio_set_routing(job.bus, "routing_type", job.previousRouting.type);
        ode_audio_set_routing(job.bus, "routing_channel", job.previousRouting.channel);
      }
    } catch (_) {}
  }
  if (job.transport) {
    try {
      var song = job.transport.song;
      if (job.transport.owned && Number(ode_audio_get(song, "is_playing")) === 1 && !Number(ode_audio_get(song, "record_mode")) && !Number(ode_audio_get(song, "session_record")) && Number(ode_audio_get(song, "loop")) === 0) {
        song.call("stop_playing");
        song.set("current_song_time", job.transport.position);
      }
      if (Number(ode_audio_get(song, "loop")) === 0 && job.transport.loop) song.set("loop", job.transport.loop);
    } catch (_) {}
  }
  if (job.buffer) {
    try { job.buffer.freepeer(); } catch (_) {}
    try { odePatcher.getnamed("odeCaptureBuffer").message("sizeinsamps", 1); } catch (_) {}
  }
}
function ode_audio_stop() {
  var job = odeAudio.job;
  odeAudio.job = null;
  odeAudio.catalogue = null;
  odeAudio.done = [];
  if (job) ode_audio_restore(job);
}
function ode_audio_error(id, error) {
  var job = odeAudio.job;
  if (job && job.id === id) { odeAudio.job = null; ode_audio_restore(job); }
  ode_audio_remember(id);
  ode_audio_send({ kind: "error", id: id, error: String(error && error.message || error).slice(0, 1000) });
}
function ode_audio_observed_beat() {
  try { var beat = Number(ode_audio_get(new LiveAPI(null, "live_set"), "current_song_time")); return Number.isFinite(beat) ? beat : null; }
  catch (_) { return null; }
}
function ode_audio_check(job) {
  if (!odeAudio.dsp) throw new Error("Live's audio engine stopped during capture.");
  if (odeAudio.rate !== job.rate) throw new Error("Live's sample rate changed during capture; the take was cancelled.");
  if (ode_audio_host_identity() !== job.hostIdentity) throw new Error("Ode's host track or device chain changed during capture.");
  if (job.bus && (ode_audio_routing(job.bus, "routing_type").identifier !== job.target.type.identifier || ode_audio_routing(job.bus, "routing_channel").identifier !== job.target.channel.identifier)) throw new Error("The capture source or routing stage changed during the take.");
}
function ode_audio_monitor() {
  var job = odeAudio.job;
  if (!job) return;
  try {
    ode_audio_check(job);
    if (job.transport) {
      var song = job.transport.song;
      var now = Date.now();
      var beat = Number(ode_audio_get(song, "current_song_time"));
      var movement = beat - job.transport.lastBeat;
      var maximum = (now - job.transport.lastTime) / 1000 * 999 / 60 + 0.25;
      if (Number(ode_audio_get(song, "is_playing")) !== 1 || Number(ode_audio_get(song, "record_mode")) || Number(ode_audio_get(song, "session_record")) || Number(ode_audio_get(song, "loop")) !== 0 || movement < -0.01 || movement > maximum) {
        job.transport.owned = false;
        throw new Error("The transport changed during Ode's capture; the take was cancelled.");
      }
      job.transport.lastBeat = beat; job.transport.lastTime = now;
      if (job.waiting && beat >= job.startBeat) ode_audio_start_recording(job);
    }
  } catch (error) { ode_audio_error(job.id, error); }
}
function ode_audio_start_recording(job) {
  if (odeAudio.job !== job || job.recording) return;
  job.waiting = false; job.recording = true;
  job.startedBeat = ode_audio_observed_beat();
  job.startedSample = odeAudio.flags & 1 ? odeAudio.sample : null;
  ode_audio_object("odeCaptureRecorder", 1);
  // The fixed-size buffer stops record~ itself. The Task waits for its final vector before reading.
  job.finishTask = ode_audio_task(ode_audio_recorded, job.frames / job.rate * 1000 + 25);
}
function ode_audio_capture(command) {
  if (odeAudio.job) throw new Error("Wait for the current audio capture to finish.");
  var catalogue = odeAudio.catalogue;
  if (!catalogue || command.catalogueId !== catalogue.catalogueId || !catalogue.targets[command.sourceId]) throw new Error("Read the current audio sources again before capturing.");
  if (ode_audio_host_identity() !== catalogue.hostIdentity) throw new Error("Ode moved or its host device chain changed. Read the audio sources again.");
  var rate = odeAudio.rate;
  var duration = Number(command.durationSeconds);
  var frames = Math.ceil(duration * rate);
  if (!odeAudio.dsp || !Number.isFinite(rate) || rate < 8000 || rate > 384000) throw new Error("Live's audio engine is not ready for capture.");
  if (!Number.isFinite(duration) || duration <= 0 || duration > ODE_AUDIO.maxDurationSeconds || frames > ODE_AUDIO.maxFrames) throw new Error("Choose an audio duration within the bounded capture limit.");
  var job = { id: command.id, catalogueId: command.catalogueId, sourceId: command.sourceId, target: catalogue.targets[command.sourceId], hostIdentity: catalogue.hostIdentity, frames: frames, rate: rate, offset: 0, startedBeat: null, endedBeat: null, prerollBeats: 0 };
  odeAudio.job = job;
  try {
    if (!job.target.local) {
      job.bus = new LiveAPI(null, "id " + job.target.busId);
      var available = ode_audio_routing(job.bus, "available_routing_types").available_routing_types || [];
      if (!available.some(function (item) { return item.identifier === job.target.type.identifier; })) throw new Error("The chosen track is no longer an available audio source.");
      job.previousRouting = { type: ode_audio_routing(job.bus, "routing_type"), channel: ode_audio_routing(job.bus, "routing_channel") };
      ode_audio_set_routing(job.bus, "routing_type", job.target.type);
      var channels = ode_audio_routing(job.bus, "available_routing_channels").available_routing_channels || [];
      if (!channels.some(function (item) { return item.identifier === job.target.channel.identifier; })) throw new Error("The chosen routing stage is no longer available.");
      ode_audio_set_routing(job.bus, "routing_channel", job.target.channel);
      job.channelSet = true;
      if (ode_audio_routing(job.bus, "routing_type").identifier !== job.target.type.identifier || ode_audio_routing(job.bus, "routing_channel").identifier !== job.target.channel.identifier) throw new Error("Live did not accept the requested capture routing.");
    }
    ode_audio_object("odeCaptureLeft", job.target.local ? 1 : 2);
    ode_audio_object("odeCaptureRight", job.target.local ? 1 : 2);
    var bufferObject = odePatcher.getnamed("odeCaptureBuffer");
    ode_audio_object("odeCaptureRecorder", 0);
    bufferObject.message("sr", rate); bufferObject.message("sizeinsamps", frames); bufferObject.message("clear");
    odePatcher.getnamed("odeCaptureRecorder").message("reset");
    if (!odeAudio.bufferName) throw new Error("Max's capture buffer is not initialised yet.");
    job.buffer = new Buffer(odeAudio.bufferName);
    if (job.buffer.channelcount() !== 2 || job.buffer.framecount() !== frames) throw new Error("Max could not allocate the requested stereo capture buffer.");
    if (command.startBeat !== undefined) {
      var start = Number(command.startBeat), preroll = Number(command.prerollBeats || 0);
      if (!Number.isFinite(start) || start < 0 || !Number.isFinite(preroll) || preroll < 0 || preroll > 64) throw new Error("Choose a nonnegative start beat and preroll of at most 64 beats.");
      var song = new LiveAPI(null, "live_set");
      if (Number(ode_audio_get(song, "is_playing")) || Number(ode_audio_get(song, "record_mode")) || Number(ode_audio_get(song, "session_record"))) throw new Error("Stop playback and recording before asking Ode to start a range capture.");
      if (Number(ode_audio_get(song, "back_to_arranger"))) throw new Error("Return to Arrangement playback before a range capture.");
      job.startBeat = start; job.prerollBeats = Math.min(start, preroll); job.waiting = true;
      job.transport = { song: song, owned: true, position: Number(ode_audio_get(song, "current_song_time")), loop: Number(ode_audio_get(song, "loop")), lastBeat: start - job.prerollBeats, lastTime: Date.now() };
      song.set("loop", 0); song.set("current_song_time", start - job.prerollBeats); song.call("start_playing");
      job.monitorTask = new Task(ode_audio_monitor, this); job.monitorTask.interval = 20; job.monitorTask.repeat();
      ode_audio_monitor();
    } else {
      if (command.prerollBeats) throw new Error("Preroll requires an explicit start beat.");
      job.monitorTask = new Task(ode_audio_monitor, this); job.monitorTask.interval = 100; job.monitorTask.repeat();
      ode_audio_start_recording(job);
    }
  } catch (error) { ode_audio_error(job.id, error); }
}
function ode_audio_recorded() {
  var job = odeAudio.job;
  if (!job || !job.recording) return;
  try { ode_audio_check(job); } catch (error) { ode_audio_error(job.id, error); return; }
  releaseTask(job.finishTask); job.finishTask = null;
  ode_audio_object("odeCaptureRecorder", 0);
  job.recording = false; job.endedBeat = ode_audio_observed_beat();
  job.endedSample = odeAudio.flags & 1 ? odeAudio.sample : null;
  // Restore playback before transferring the frozen buffer; polling continues independently.
  releaseTask(job.monitorTask); job.monitorTask = null;
  var saved = job.buffer; job.buffer = null; ode_audio_restore(job); job.buffer = saved; job.transport = null; job.bus = null;
  ode_audio_send({ kind: "begin", id: job.id, catalogueId: job.catalogueId, sourceId: job.sourceId, sampleRate: job.rate, channels: 2, frames: job.frames }, function (ok) {
    if (odeAudio.job !== job) return;
    if (!ok) { ode_audio_error(job.id, "Ode could not accept the captured audio."); return; }
    job.uploadTask = ode_audio_task(ode_audio_upload_next, 0);
  });
}
function ode_audio_upload_next() {
  var job = odeAudio.job;
  if (!job) return;
  releaseTask(job.uploadTask); job.uploadTask = null;
  if (job.offset >= job.frames) {
    ode_audio_send({ kind: "complete", id: job.id, frames: job.frames, timing: { startedBeat: job.startedBeat, endedBeat: job.endedBeat, prerollBeats: job.prerollBeats,
      rangeUncertainty: "Beat positions were observed on Max's message thread. Capture begins at a DSP vector after the start message; the end observation follows buffer completion by about 25 ms. This is a real-time take, not a sample-accurate Arrangement render. Host sample counters at those message observations: " + job.startedSample + " to " + job.endedSample + "." } }, function (ok) {
      if (odeAudio.job !== job) return;
      if (!ok) { ode_audio_error(job.id, "Ode could not finalise the captured audio."); return; }
      odeAudio.job = null; ode_audio_restore(job); ode_audio_remember(job.id);
    });
    return;
  }
  try {
    var count = Math.min(ODE_AUDIO.chunkFrames, job.frames - job.offset);
    var channels = [job.buffer.peek(1, job.offset, count), job.buffer.peek(2, job.offset, count)];
    channels = channels.map(function (samples) { return Array.isArray(samples) ? samples : [samples]; });
    if (channels.some(function (samples) { return samples.length !== count || samples.some(function (sample) { return typeof sample !== "number" || !Number.isFinite(sample); }); })) throw new Error("Max returned incomplete or nonfinite captured samples.");
    ode_audio_send({ kind: "chunk", id: job.id, offset: job.offset, channels: channels }, function (ok) {
      if (odeAudio.job !== job) return;
      if (!ok) { ode_audio_error(job.id, "Ode could not receive the captured samples."); return; }
      job.offset += count; job.uploadTask = ode_audio_task(ode_audio_upload_next, 0);
    });
  } catch (error) { ode_audio_error(job.id, error); }
}
function ode_audio_command(command) {
  if (!command || typeof command.id !== "string" || command.id.length > 512) return;
  if (command.kind === "cancel") {
    if (odeAudio.job && odeAudio.job.id === command.id) { var job = odeAudio.job; odeAudio.job = null; ode_audio_restore(job); }
    ode_audio_remember(command.id); return;
  }
  if (odeAudio.done.includes(command.id) || odeAudio.job && odeAudio.job.id === command.id) return;
  try {
    if (command.kind === "sources") ode_audio_sources(command.id);
    else if (command.kind === "capture") ode_audio_capture(command);
  } catch (error) { ode_audio_error(command.id, error); }
}
