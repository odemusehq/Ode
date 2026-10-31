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
  if (!address || typeof address.path !== "string" || !/^live_set (?:tracks \d+|return_tracks \d+|master_track)(?: devices \d+(?: chains \d+)?)*$/.test(address.path) || !Array.isArray(address.guards) || !address.guards.length || address.guards.length > 64) throw new Error(ODE_DAW_COPY.invalid);
  var ids = [];
  address.guards.forEach(function (guard) {
    if (!guard || typeof guard.path !== "string" || !(address.path === guard.path || address.path.indexOf(guard.path + " ") === 0)) throw new Error(ODE_DAW_COPY.invalid);
    var ancestor = new LiveAPI(null, guard.path);
    if (!ancestor.id || String(ancestor.id) === "0" || guard.name !== undefined && String(ode_daw_get(ancestor, "name")) !== guard.name) throw new Error(ODE_DAW_COPY.changed);
    ids.push(String(ancestor.id));
  });
  var api = new LiveAPI(null, address.path);
  if (!api.id || String(api.id) === "0") throw new Error(ODE_DAW_COPY.changed);
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
function ode_daw_execute(command) {
  if (typeof odeAudio !== "undefined" && odeAudio.job && !/(_read|_meters)$/.test(command.op)) throw new Error(ODE_DAW_COPY.capturing);
  if (command.op === "return_create") return ode_daw_return(command.args);
  var target = ode_daw_target(command.address), args = command.args;
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
