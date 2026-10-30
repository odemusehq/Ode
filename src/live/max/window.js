/* Embedded in Ode.amxd. Uses the Max 9.1 Task and XMLHttpRequest APIs. */
var inlets = 2;
var outlets = 1;
var odePatcher = this.patcher;
var running = false;
var loop = null;
var busy = false;
var generation = 0;
var requests = [];
var session = "";
var port = 0;
var consumedLatch = 0;
var consumedPort = 0;
var consumedCapability = "";
var pageUrl = "";
var connectedPageUrl = "";
var loaded = false;
var wantsOpen = false;
var pending = null;
var completedIds = [];
var nextLocalId = 0;
var browserWidth = 0;
var browserHeight = 0;

function status(message) {
  try { odePatcher.getnamed("odeStatus").message("set", message); } catch (_) {}
}

function windowObjects() {
  var child = odePatcher.getnamed("odeWindow").subpatcher();
  return { child: child, browser: child.getnamed("odeBrowser"), control: child.getnamed("odeWindowControl") };
}

function fitWindow() {
  try {
    var objects = windowObjects();
    if (!objects.child.wind.visible) return;
    var size = objects.child.wind.size;
    var width = Math.round(Number(size[0]));
    var height = Math.round(Number(size[1]));
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return;
    if (width === browserWidth && height === browserHeight) return;
    objects.browser.rect = [0, 0, width, height];
    objects.browser.message("sendbox", "presentation_rect", 0, 0, width, height);
    browserWidth = width;
    browserHeight = height;
  } catch (_) { /* A closed patcher may have no native window yet. */ }
}

function number(name) {
  var value = Number(odePatcher.getnamed(name).getvalueof());
  return Number.isFinite(value) && value >= 0 && value <= 65535 ? Math.round(value) : -1;
}

function start() {
  if (running) return;
  running = true;
  status("Connecting to Ode…");
  loop = new Task(tick, this);
  loop.interval = ODE_WINDOW.pollMs;
  loop.repeat();
}

function releaseTask(task) {
  if (!task) return;
  try { task.cancel(); } catch (_) {}
  try { if (typeof task.freepeer === "function") task.freepeer(); } catch (_) {}
}

function stop() {
  running = false;
  generation += 1;
  releaseTask(loop);
  loop = null;
  var active = requests.slice();
  requests = [];
  for (var index = 0; index < active.length; index++) active[index].cancel();
  busy = false;
  session = "";
  pending = null;
  completedIds = [];
  wantsOpen = false;
  try { windowObjects().control.message("wclose"); } catch (_) {}
}

function notifydeleted() { stop(); }

function http(path, body, callback) {
  var expected = generation;
  var xhr = new XMLHttpRequest();
  var finished = false;
  var timer = new Task(function () { finish(null, 0); try { xhr.abort(); } catch (_) {} }, this);
  var request = { xhr: xhr, timer: timer, cancel: function () { finish(null, 0); try { xhr.abort(); } catch (_) {} } };
  requests.push(request);
  function finish(value, code) {
    if (finished) return;
    finished = true;
    releaseTask(timer);
    var index = requests.indexOf(request);
    if (index >= 0) requests.splice(index, 1);
    if (running && expected === generation) callback(value, code);
  }
  try {
    xhr.open("POST", "http://127.0.0.1:" + port + path);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var result = null;
      try { result = JSON.parse(xhr.responseText); } catch (_) {}
      finish(result, Number(xhr.status));
    };
    timer.schedule(Math.min(3000, ODE_WINDOW.leaseMs - ODE_WINDOW.pollMs));
    xhr.send(JSON.stringify(body));
  } catch (_) { finish(null, 0); }
}

function safeUrl(url) {
  return typeof url === "string" && new RegExp("^http://localhost:" + port + "/\\?view=(ask|lyrics|history|settings)&token=[0-9a-f]{48}$").test(url);
}

function disconnect() {
  generation += 1;
  session = "";
  busy = false;
  pending = null;
  status("Ode disconnected. Open Ode from Live to reconnect.");
}

function tick() {
  if (!running) return;
  fitWindow();
  if (busy) return;
  if (pending && Date.now() - pending.started > ODE_WINDOW.openTimeoutMs) {
    finishOpen(pending.id, "error", "Ode's page did not become ready. Press Open Ode to retry.");
  }
  var names = ODE_WINDOW.parameterNames;
  var nextPort = number(names.port);
  var latch = number(names.latch);
  // The extension clears bootstrap controls after connect. A private session survives that clearing.
  if (nextPort > 0 && latch > 0) {
    var capability = "";
    for (var index = 0; index < names.words.length; index++) {
      var word = number(names.words[index]);
      if (word < 0) { status("Ode's connection is incomplete. Open Ode from Live to retry."); return; }
      capability += ("0000" + word.toString(16)).slice(-4);
    }
    if (latch !== consumedLatch || nextPort !== consumedPort || capability !== consumedCapability) {
      consumedLatch = latch;
      consumedPort = nextPort;
      consumedCapability = capability;
      port = nextPort;
      generation += 1;
      session = "";
      busy = true;
      status("Connecting to Ode…");
      http(ODE_WINDOW.api.connect, { capability: capability }, function (response, code) {
        busy = false;
        if (code !== 200 || !response || typeof response.session !== "string" || !response.session || !safeUrl(response.url)) {
          status("Connection failed. Open Ode from Live, then retry.");
          return;
        }
        session = response.session;
        pageUrl = response.url;
        if (connectedPageUrl !== pageUrl) loaded = false;
        connectedPageUrl = pageUrl;
        status("Ready. Press Open Ode.");
        if (wantsOpen) open_ode();
      });
      return;
    }
  }
  if (!session) {
    status("Load the Ode extension, then choose Open Ode in Live.");
    return;
  }
  busy = true;
  http(ODE_WINDOW.api.poll, { session: session }, function (response, code) {
    busy = false;
    if (code !== 200 || !response || !Object.prototype.hasOwnProperty.call(response, "command")) { disconnect(); return; }
    if (response.command && !pending) openCommand(response.command, false);
  });
}

function open_ode() {
  wantsOpen = true;
  if (!running) start();
  if (!session) { consumedCapability = ""; tick(); return; }
  if (pending) return;
  wantsOpen = false;
  openCommand({ id: "local-" + (++nextLocalId), view: "ask", url: pageUrl }, true);
}

function openCommand(command, local) {
  if (command && completedIds.includes(command.id)) return;
  if (!command || typeof command.id !== "string" || command.id.length > 128 || !["ask", "lyrics", "history", "settings"].includes(command.view) || !safeUrl(command.url)) {
    status("Ode sent an invalid window request. Reopen Ode from Live.");
    return;
  }
  pending = { id: command.id, local: local, started: Date.now() };
  status("Opening Ode…");
  try {
    var objects = windowObjects();
    if (loaded) objects.browser.message("ode_open", command.view, command.url, command.id);
    else objects.browser.message("read", command.url + "&odeWindowCommand=" + encodeURIComponent(command.id));
  } catch (_) { finishOpen(command.id, "error", "Ode's window stayed closed. Press Open Ode to retry."); }
}

function frontWindow() {
  var control = windowObjects().control;
  control.message("window", "flags", "float", "grow", "close", "nozoom", "nomenu");
  control.message("window", "exec");
  outlet(0, "open");
  control.message("front");
  fitWindow();
}

function finishOpen(id, result, error) {
  if (!pending || pending.id !== String(id)) return;
  var command = pending;
  completedIds.push(command.id);
  if (completedIds.length > ODE_WINDOW.maxPending * 4) completedIds.shift();
  pending = null;
  if (result === "ready") {
    loaded = true;
    status("Ode is open.");
    try { frontWindow(); }
    catch (_) { result = "error"; error = "Ode's window could not open. Press Open Ode to retry."; }
  }
  if (result !== "ready") {
    if (loaded) try { frontWindow(); } catch (_) {}
    status(error || "Ode's page stayed closed. Press Open Ode to retry.");
  }
  if (!command.local && session) {
    var payload = { session: session, id: command.id, status: result };
    if (result !== "ready") payload.error = String(error || "Ode's page stayed closed.").slice(0, ODE_WINDOW.errorMaxChars);
    // A valid connection can outlive a command that the server already timed out.
    http(ODE_WINDOW.api.ack, payload, function (_response, code) { if (code !== 200 && code !== 409) disconnect(); });
  }
}

function ode_opened(id) { finishOpen(String(id), "ready"); }
function ode_open_failed(id, message) { finishOpen(String(id), "error", String(message || "Save the open draft, then retry.").slice(0, ODE_WINDOW.errorMaxChars)); }
function ode_close() { try { windowObjects().control.message("wclose"); } catch (_) {} }
function anything() { /* jweb also emits URL/title/load notifications; none proves the app is ready. */ }
