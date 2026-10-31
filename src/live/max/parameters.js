/* Native DeviceParameter access only. No unit conversion, arbitrary calls or parameter guessing. */
var odeParameters = { reads: {}, readOrder: [], replies: {}, replyOrder: [] };

function ode_parameters_stop() { odeParameters = { reads: {}, readOrder: [], replies: {}, replyOrder: [] }; }
function ode_parameters_scalar(value) { return Array.isArray(value) && value.length === 1 ? ode_parameters_scalar(value[0]) : value; }
function ode_parameters_get(api, key) { return ode_parameters_scalar(api.get(key)); }
function ode_parameters_optional(api, key) {
  try { var value = ode_parameters_get(api, key); return typeof value === "number" && Number.isFinite(value) ? value : null; } catch (_) { return null; }
}
function ode_parameters_text(value) {
  value = ode_parameters_scalar(value);
  if (typeof value === "string" && value.length) return value;
  if (Array.isArray(value) && value.length && value.every(function (part) { return typeof part === "string" || typeof part === "number"; })) return value.join(" ");
  return null;
}
function ode_parameters_keep(table, order, key, value, limit) {
  if (!Object.prototype.hasOwnProperty.call(table, key)) order.push(key);
  table[key] = value;
  while (order.length > limit) delete table[order.shift()];
}
function ode_parameters_hidden(name) {
  var names = ODE_WINDOW.parameterNames;
  return name === names.signature || name === names.port || name === names.latch || names.words.indexOf(name) !== -1;
}
function ode_parameters_target(address) {
  var pattern = /^live_set (?:tracks \d+|return_tracks \d+|master_track)(?: devices \d+(?: chains \d+)?)*(?: parameters \d+| mixer_device (?:volume|panning|sends \d+))$/;
  if (!address || typeof address.path !== "string" || !pattern.test(address.path) || !Array.isArray(address.guards) || !address.guards.length || address.guards.length > 64) throw new Error(ODE_PARAMETER_COPY.invalid);
  var ids = [];
  address.guards.forEach(function (guard) {
    if (!guard || typeof guard.path !== "string" || !(address.path === guard.path || address.path.indexOf(guard.path + " ") === 0)) throw new Error(ODE_PARAMETER_COPY.invalid);
    var object = new LiveAPI(null, guard.path);
    if (!object.id || String(object.id) === "0") throw new Error(ODE_PARAMETER_COPY.changed);
    if (guard.name !== undefined && String(ode_parameters_get(object, "name")) !== guard.name) throw new Error(ODE_PARAMETER_COPY.changed);
    ids.push(String(object.id));
  });
  var api = new LiveAPI(null, address.path);
  if (!api.id || String(api.id) === "0" || api.type !== "DeviceParameter") throw new Error(ODE_PARAMETER_COPY.notParameter);
  var name = String(ode_parameters_get(api, "name"));
  if (ode_parameters_hidden(name)) throw new Error(ODE_PARAMETER_COPY.hidden);
  return { api: api, name: name, ids: ids.concat(String(api.id)) };
}
function ode_parameters_read(target, path, token) {
  var raw = ode_parameters_get(target.api, "value");
  if (typeof raw !== "number" || !Number.isFinite(raw)) throw new Error(ODE_PARAMETER_COPY.invalid);
  var formatted = null;
  try { formatted = ode_parameters_text(target.api.call("__str__")); } catch (_) {}
  if (formatted === null) { try { formatted = ode_parameters_text(target.api.call("str_for_value", raw)); } catch (_) {} }
  var enabled = ode_parameters_optional(target.api, "is_enabled");
  return { token: token, path: path, name: target.name, rawValue: raw, displayValue: ode_parameters_optional(target.api, "display_value"), formattedValue: formatted,
    isEnabled: enabled === null ? null : enabled === 1, state: ode_parameters_optional(target.api, "state"), automationState: ode_parameters_optional(target.api, "automation_state") };
}
function ode_parameters_command(command) {
  if (!running || !session || !command || typeof command.id !== "string") return;
  var key = JSON.stringify(command), cached = odeParameters.replies[command.id];
  if (cached) { if (cached.key === key) http(ODE_PARAMETERS.messagePath, { session: session, message: cached.message }, function () {}); return; }
  var message;
  try {
    if ((command.kind !== "read" && command.kind !== "set") || typeof command.scope !== "string" || !command.scope.length) throw new Error(ODE_PARAMETER_COPY.invalid);
    var target = ode_parameters_target(command.address);
    if (command.kind === "read") {
      var reading = ode_parameters_read(target, command.address.path, command.id);
      ode_parameters_keep(odeParameters.reads, odeParameters.readOrder, command.id, { scope: command.scope, address: JSON.stringify(command.address), ids: JSON.stringify(target.ids), reading: reading }, 128);
      message = { kind: "read", id: command.id, result: reading };
    } else {
      var saved = odeParameters.reads[command.token];
      delete odeParameters.reads[command.token];
      if (!saved || saved.scope !== command.scope || saved.address !== JSON.stringify(command.address) || saved.ids !== JSON.stringify(target.ids)) throw new Error(ODE_PARAMETER_COPY.changed);
      var before = ode_parameters_read(target, command.address.path, command.token);
      if (before.rawValue !== saved.reading.rawValue) throw new Error(ODE_PARAMETER_COPY.changed);
      if (before.displayValue === null || saved.reading.displayValue === null) throw new Error(ODE_PARAMETER_COPY.unsupported);
      if (before.isEnabled !== true || before.state !== 0 && before.state !== 1) throw new Error(ODE_PARAMETER_COPY.disabled);
      if (before.automationState === null || before.automationState === 1 && command.allowAutomationOverride !== true) throw new Error(ODE_PARAMETER_COPY.automated);
      if (typeof command.value !== "number" || !Number.isFinite(command.value)) throw new Error(ODE_PARAMETER_COPY.invalid);
      target.api.set("display_value", command.value);
      var after = ode_parameters_read(target, command.address.path, command.id);
      ode_parameters_keep(odeParameters.reads, odeParameters.readOrder, command.id, { scope: command.scope, address: JSON.stringify(command.address), ids: JSON.stringify(target.ids), reading: after }, 128);
      message = { kind: "set", id: command.id, result: { before: before, after: after } };
    }
  } catch (error) { message = { kind: "error", id: command.id, error: String(error && error.message || error).slice(0, 1024) || ODE_PARAMETER_COPY.invalid }; }
  ode_parameters_keep(odeParameters.replies, odeParameters.replyOrder, command.id, { key: key, message: message }, 64);
  http(ODE_PARAMETERS.messagePath, { session: session, message: message }, function () {});
}
