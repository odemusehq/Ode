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
function ode_daw_execute(command) {
  var target = ode_daw_target(command.address), args = command.args;
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
