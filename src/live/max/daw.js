/* Named native DAW operations only. No filesystem discovery, DSP or menu automation. */
var odeDaw = { reads: {}, readOrder: [], replies: {}, replyOrder: [] };
function ode_daw_stop() { odeDaw = { reads: {}, readOrder: [], replies: {}, replyOrder: [] }; }
function ode_daw_scalar(value) { return Array.isArray(value) && value.length === 1 ? value[0] : value; }
function ode_daw_get(api, key) { return ode_daw_scalar(api.get(key)); }
function ode_daw_optional(api, key) { try { return ode_daw_get(api, key); } catch (_) { return null; } }
function ode_daw_keep(table, order, id, value, limit) {
  if (!Object.prototype.hasOwnProperty.call(table, id)) order.push(id);
  table[id] = value;
  while (order.length > limit) delete table[order.shift()];
}
function ode_daw_target(address) {
  if (!address || typeof address.path !== "string" || !/^live_set (?:tracks \d+|return_tracks \d+|master_track)(?:(?: devices \d+(?: chains \d+)?)*| clip_slots \d+ clip|(?: take_lanes \d+)? arrangement_clips \d+)$/.test(address.path) || !Array.isArray(address.guards) || !address.guards.length || address.guards.length > 64) throw new Error(ODE_DAW_COPY.invalid);
  var ids = [];
  address.guards.forEach(function (guard) {
    if (!guard || typeof guard.path !== "string" || !(address.path === guard.path || address.path.indexOf(guard.path + " ") === 0)) throw new Error(ODE_DAW_COPY.invalid);
    var ancestor = new LiveAPI(null, guard.path);
    if (!ancestor.id || String(ancestor.id) === "0" || guard.name !== undefined && String(ode_daw_get(ancestor, "name")) !== guard.name) throw new Error(ODE_DAW_COPY.changed);
    ids.push(String(ancestor.id));
  });
  var api = new LiveAPI(null, address.path);
  if (!api.id || String(api.id) === "0") throw new Error(ODE_DAW_COPY.changed);
  if (address.clip && (address.clip.startTime !== undefined && ode_daw_get(api, "start_time") !== address.clip.startTime || address.clip.filePath !== undefined && String(ode_daw_get(api, "file_path")) !== address.clip.filePath)) throw new Error(ODE_DAW_COPY.changed);
  return { api: api, path: address.path, ids: ids.concat(String(api.id)) };
}
function ode_daw_remember(command, target, state) {
  ode_daw_keep(odeDaw.reads, odeDaw.readOrder, command.id, { scope: command.scope, address: JSON.stringify(command.address), ids: JSON.stringify(target.ids), state: JSON.stringify(state) }, 128);
  return Object.assign({ readToken: command.id }, state);
}
function ode_daw_check(command, target, state) {
  var saved = odeDaw.reads[command.args.readToken];
  delete odeDaw.reads[command.args.readToken];
  if (!saved || saved.scope !== command.scope || saved.address !== JSON.stringify(command.address) || saved.ids !== JSON.stringify(target.ids) || saved.state !== JSON.stringify(state)) throw new Error(ODE_DAW_COPY.changed);
}
function ode_daw_plugin(target) {
  if (target.api.type !== "PluginDevice") throw new Error(ODE_DAW_COPY.notPlugin);
  var presets = target.api.get("presets");
  if (!Array.isArray(presets) || !presets.every(function (name) { return typeof name === "string"; })) throw new Error(ODE_DAW_COPY.unsupported);
  return { name: String(ode_daw_get(target.api, "name")), presets: presets, selectedPresetIndex: ode_daw_get(target.api, "selected_preset_index"), editorOpen: ode_daw_get(target.api, "is_editor_open") === 1 };
}
function ode_daw_dictionary(api, key) {
  var value = api.get(key);
  if (Array.isArray(value) && value[0] === "dictionary") value = JSON.parse(new Dict(String(value[1])).stringify());
  else {
    value = ode_daw_scalar(value);
    if (typeof value === "string") value = value.indexOf("dictionary ") === 0 ? JSON.parse(new Dict(value.slice(11)).stringify()) : JSON.parse(value);
  }
  if (!value || typeof value !== "object") throw new Error(ODE_DAW_COPY.unsupported);
  return value[key] || value;
}
function ode_daw_routes(target, compressor) {
  if (target.api.type !== (compressor ? "CompressorDevice" : "Track")) throw new Error(ODE_DAW_COPY.unsupported);
  var result = { name: String(ode_daw_get(target.api, "name")) };
  var fields = ["input_routing_type", "input_routing_channel"].concat(compressor ? [] : ["output_routing_type", "output_routing_channel"]);
  fields.forEach(function (field) {
    try { result[field] = ode_daw_dictionary(target.api, field); } catch (_) { result[field] = null; }
    try { result["available_" + field + "s"] = ode_daw_dictionary(target.api, "available_" + field + "s"); } catch (_) { result["available_" + field + "s"] = null; }
  });
  return result;
}
function ode_daw_recording() {
  var song = new LiveAPI(null, "live_set");
  return ode_daw_optional(song, "record_mode") === 1 || ode_daw_optional(song, "session_record") === 1;
}
function ode_daw_route_set(command, target, compressor) {
  var before = ode_daw_routes(target, compressor), args = command.args;
  ode_daw_check(command, target, before);
  if (ode_daw_recording()) throw new Error(ODE_DAW_COPY.recording);
  var fields = ["input_routing_type", "input_routing_channel"].concat(compressor ? [] : ["output_routing_type", "output_routing_channel"]);
  if (fields.indexOf(args.field) === -1) throw new Error(ODE_DAW_COPY.invalid);
  var offered = before["available_" + args.field + "s"];
  if (!Array.isArray(offered)) throw new Error(ODE_DAW_COPY.unsupported);
  var selected = offered.filter(function (value) { return value && value.identifier === args.identifier; });
  if (selected.length !== 1) throw new Error(ODE_DAW_COPY.changed);
  target.api.set(args.field, JSON.stringify(selected[0]));
  return { before: before, after: ode_daw_routes(target, compressor), restoration: ODE_DAW_COPY.nativeUndo };
}
function ode_daw_ids(value) {
  if (!Array.isArray(value)) value = [value];
  return value.filter(function (part) { return /^\d+$/.test(String(part)) && Number(part) > 0; }).map(Number);
}
function ode_daw_return(args) {
  if (ode_daw_recording()) throw new Error(ODE_DAW_COPY.recording);
  var song = new LiveAPI(null, "live_set"), before = ode_daw_ids(song.get("return_tracks"));
  song.call("create_return_track");
  var after = ode_daw_ids(song.get("return_tracks"));
  var created = after.filter(function (id) { return before.indexOf(id) === -1; });
  if (created.length !== 1) return { created: true, warning: ODE_DAW_COPY.inspectCreated };
  var track = new LiveAPI(null, "id " + created[0]);
  if (args.name !== undefined) track.set("name", args.name);
  return { created: true, track: { returnIndex: after.indexOf(created[0]) }, name: String(ode_daw_get(track, "name")) };
}
function ode_daw_clip(target) {
  if (target.api.type !== "Clip") throw new Error(ODE_DAW_COPY.unsupported);
  var state = { name: String(ode_daw_get(target.api, "name")), isAudio: ode_daw_get(target.api, "is_audio_clip") === 1 };
  ["start_marker", "end_marker", "loop_start", "loop_end"].concat(state.isAudio ? ["file_path", "gain", "gain_display_string", "pitch_coarse", "pitch_fine", "warping", "warp_mode"] : []).forEach(function (field) { state[field] = ode_daw_optional(target.api, field); });
  if (state.isAudio) { try { state.warp_markers = ode_daw_dictionary(target.api, "warp_markers"); } catch (_) { state.warp_markers = null; } }
  return state;
}
function ode_daw_clip_edit(command, target) {
  var before = ode_daw_clip(target), args = command.args;
  ode_daw_check(command, target, before);
  if (ode_daw_optional(target.api, "is_recording") !== 0) throw new Error(ODE_DAW_COPY.recording);
  if (command.op === "clip_set") {
    var fields = ["start_marker", "end_marker", "loop_start", "loop_end"].concat(before.isAudio ? ["gain", "pitch_coarse", "pitch_fine"] : []);
    if (fields.indexOf(args.field) === -1 || typeof args.value !== "number" || !Number.isFinite(args.value) || before[args.field] === null) throw new Error(ODE_DAW_COPY.unsupported);
    if (args.field === "gain" && (args.value < 0 || args.value > 1) || args.field === "pitch_coarse" && (!Number.isInteger(args.value) || args.value < -48 || args.value > 48) || args.field === "pitch_fine" && (args.value < -50 || args.value > 49)) throw new Error(ODE_DAW_COPY.invalid);
    if (args.field === "start_marker" && args.value >= before.end_marker || args.field === "end_marker" && args.value <= before.start_marker || args.field === "loop_start" && args.value >= before.loop_end || args.field === "loop_end" && args.value <= before.loop_start) throw new Error(ODE_DAW_COPY.invalid);
    if ((args.field === "loop_start" || args.field === "loop_end") && before.isAudio && before.warping !== 1) throw new Error(ODE_DAW_COPY.unsupported);
    target.api.set(args.field, args.value);
  } else {
    if (!before.isAudio || before.warping !== 1 || typeof args.beatTime !== "number" || !Number.isFinite(args.beatTime)) throw new Error(ODE_DAW_COPY.unsupported);
    if (args.action === "add") {
      var marker = { beat_time: args.beatTime };
      if (args.sampleTime !== undefined) { if (typeof args.sampleTime !== "number" || !Number.isFinite(args.sampleTime) || args.sampleTime < 0) throw new Error(ODE_DAW_COPY.invalid); marker.sample_time = args.sampleTime; }
      target.api.call("add_warp_marker", JSON.stringify(marker));
    } else if (args.action === "move") {
      if (typeof args.distance !== "number" || !Number.isFinite(args.distance)) throw new Error(ODE_DAW_COPY.invalid);
      target.api.call("move_warp_marker", args.beatTime, args.distance);
    } else if (args.action === "remove") target.api.call("remove_warp_marker", args.beatTime);
    else throw new Error(ODE_DAW_COPY.invalid);
  }
  return { before: before, after: ode_daw_clip(target), restoration: ODE_DAW_COPY.nativeUndo };
}
function ode_daw_execute(command) {
  if (typeof odeAudio !== "undefined" && odeAudio.job && !/(_read|_meters)$/.test(command.op)) throw new Error(ODE_DAW_COPY.capturing);
  if (command.op === "return_create") return ode_daw_return(command.args);
  var target = ode_daw_target(command.address), args = command.args;
  if (command.op === "clip_read") return ode_daw_remember(command, target, ode_daw_clip(target));
  if (command.op === "clip_set" || command.op === "clip_warp") return ode_daw_clip_edit(command, target);
  if (command.op === "clip_show") {
    if (target.api.type !== "Clip") throw new Error(ODE_DAW_COPY.unsupported);
    new LiveAPI(null, "live_set view").set("detail_clip", "id", Number(target.api.id));
    var clipView = new LiveAPI(null, "live_app view");
    clipView.call("show_view", "Detail"); clipView.call("show_view", "Detail/Clip");
    return { shown: true, name: String(ode_daw_get(target.api, "name")) };
  }
  if (command.op === "track_routing_read" || command.op === "compressor_routing_read") return ode_daw_remember(command, target, ode_daw_routes(target, command.op === "compressor_routing_read"));
  if (command.op === "track_routing_set" || command.op === "compressor_routing_set") return ode_daw_route_set(command, target, command.op === "compressor_routing_set");
  if (command.op === "track_meters") {
    if (target.api.type !== "Track") throw new Error(ODE_DAW_COPY.unsupported);
    var meters = { observedAt: new Date().toISOString(), units: "native 0..1; peak/hold meters, not dBFS, LUFS, true peak or gain reduction" };
    ["input_meter_left", "input_meter_right", "input_meter_level", "output_meter_left", "output_meter_right", "output_meter_level"].forEach(function (field) { meters[field] = ode_daw_optional(target.api, field); });
    return meters;
  }
  if (command.op === "plugin_read") {
    var state = ode_daw_plugin(target), result = ode_daw_remember(command, target, state);
    var offset = Number.isInteger(args.offset) && args.offset >= 0 ? args.offset : 0;
    result.presetCount = state.presets.length;
    result.presets = state.presets.slice(offset, offset + 128).map(function (name, index) { return { index: index + offset, name: name }; });
    result.offset = offset;
    return result;
  }
  if (command.op === "plugin_preset") {
    var before = ode_daw_plugin(target);
    ode_daw_check(command, target, before);
    if (!Number.isInteger(args.index) || args.index < 0 || args.index >= before.presets.length) throw new Error(ODE_DAW_COPY.invalid);
    target.api.set("selected_preset_index", args.index);
    return { before: { selectedPresetIndex: before.selectedPresetIndex }, after: ode_daw_plugin(target), restoration: ODE_DAW_COPY.nativeUndo };
  }
  if (command.op === "device_show") {
    if (!/ devices \d+$/.test(target.path)) throw new Error(ODE_DAW_COPY.invalid);
    if (args.editor === true) {
      if (target.api.type !== "PluginDevice") throw new Error(ODE_DAW_COPY.notPlugin);
      target.api.set("is_editor_open", 1);
      return { editorOpen: ode_daw_get(target.api, "is_editor_open") === 1 };
    }
    new LiveAPI(null, "live_set view").call("select_device", "id", Number(target.api.id));
    var view = new LiveAPI(null, "live_app view");
    view.call("show_view", "Detail"); view.call("show_view", "Detail/DeviceChain");
    return { shown: true, name: String(ode_daw_get(target.api, "name")) };
  }
  throw new Error(ODE_DAW_COPY.unsupported);
}
function ode_daw_command(command) {
  if (!running || !session || !command || typeof command.id !== "string") return;
  var key = JSON.stringify(command), saved = odeDaw.replies[command.id];
  if (saved) { if (saved.key === key) http(ODE_DAW.messagePath, { session: session, message: saved.message }, function () {}); return; }
  var message;
  try {
    if (typeof command.scope !== "string" || !command.scope.length || !command.args || typeof command.args !== "object") throw new Error(ODE_DAW_COPY.invalid);
    message = { id: command.id, ok: true, result: ode_daw_execute(command) };
  } catch (error) { message = { id: command.id, ok: false, error: String(error && error.message || error).slice(0, 2048) || ODE_DAW_COPY.invalid }; }
  if (JSON.stringify(message).length > ODE_DAW.maxBodyBytes - 512) message = { id: command.id, ok: false, error: ODE_DAW_COPY.tooLarge };
  ode_daw_keep(odeDaw.replies, odeDaw.replyOrder, command.id, { key: key, message: message }, 64);
  http(ODE_DAW.messagePath, { session: session, message: message }, function () {});
}
