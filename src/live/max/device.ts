import { t, nativeStrings } from "../../shared/i18n";
import { readFile } from "node:fs/promises";
import { MAX_WINDOW } from "../../shared/max-window";
import { MAX_AUDIO } from "../../shared/max-audio";
import { MAX_DAW } from "../../shared/max-daw";
import { MAX_PARAMETERS } from "../../shared/max-parameters";

type Box = Record<string, unknown> & { id: string };
interface Line { patchline: { source: [string, number]; destination: [string, number] } }

/** Builds the small Max audio device; all backend and Live operations remain in the extension. */
export class MaxDevice {
  /** An unfrozen .amxd container, with the same ampf/meta/ptch structure as Max's own devices. */
  static async build(): Promise<Buffer> {
    const script = `var ODE_WINDOW = ${JSON.stringify(MAX_WINDOW)};\nvar ODE_AUDIO = ${JSON.stringify(MAX_AUDIO)};\nvar ODE_PARAMETERS = ${JSON.stringify(MAX_PARAMETERS)};\nvar ODE_DAW = ${JSON.stringify(MAX_DAW)};\nvar ODE_DAW_COPY = ${JSON.stringify(nativeStrings.maxDaw)};\nvar ODE_PARAMETER_COPY = ${JSON.stringify(nativeStrings.maxParameters)};\nvar ODE_COPY = ${JSON.stringify(nativeStrings.max)};\nvar ODE_AUDIO_COPY = ${JSON.stringify(nativeStrings.maxAudio)};\n${await readFile(new URL("window.js", import.meta.url), "utf8")}\n${await readFile(new URL("audio.js", import.meta.url), "utf8")}\n${await readFile(new URL("parameters.js", import.meta.url), "utf8")}\n${await readFile(new URL("daw.js", import.meta.url), "utf8")}`;
    const patch = Buffer.from(`${JSON.stringify(MaxDevice.patch(script))}\n\0`, "utf8");
    const header = Buffer.alloc(32);
    header.write("ampf", 0, "ascii");
    header.writeUInt32LE(4, 4);
    header.write("aaaa", 8, "ascii");
    header.write("meta", 12, "ascii");
    header.writeUInt32LE(4, 16);
    header.writeUInt32LE(0, 20);
    header.write("ptch", 24, "ascii");
    header.writeUInt32LE(patch.byteLength, 28);
    return Buffer.concat([header, patch]);
  }

  static patch(script: string) {
    const boxes: { box: Box }[] = [];
    const lines: Line[] = [];
    const box = (id: string, maxclass: string, attributes: Record<string, unknown>) => boxes.push({ box: { id, maxclass, ...attributes } });
    const line = (from: string, outlet: number, to: string, inlet = 0) => lines.push({ patchline: { source: [from, outlet], destination: [to, inlet] } });
    box("audio-in", "newobj", { text: "plugin~ 1 2 3 4", numinlets: 1, numoutlets: 4, outlettype: ["signal", "signal", "signal", "signal"], patching_rect: [20, 225, 120, 22] });
    box("audio-out", "newobj", { text: "plugout~", numinlets: 2, numoutlets: 0, patching_rect: [20, 265, 65, 22] });
    line("audio-in", 0, "audio-out", 0);
    line("audio-in", 1, "audio-out", 1);
    for (const [channel, label] of ["Left", "Right"].entries()) {
      box(`capture-${channel}`, "newobj", { text: "selector~ 2", varname: `odeCapture${label}`, numinlets: 3, numoutlets: 1, outlettype: ["signal"], patching_rect: [250 + channel * 110, 480, 90, 22] });
      line("audio-in", channel, `capture-${channel}`, 1);
      line("audio-in", channel + 2, `capture-${channel}`, 2);
      line(`capture-${channel}`, 0, "capture-recorder", channel);
    }
    box("capture-buffer", "newobj", { text: "buffer~ #0-odeCapture 1 2", varname: "odeCaptureBuffer", numinlets: 1, numoutlets: 2, outlettype: ["float", "bang"], patching_rect: [470, 480, 180, 22] });
    box("capture-buffer-name", "newobj", { text: "loadmess #0-odeCapture", numinlets: 1, numoutlets: 1, outlettype: [""], patching_rect: [470, 450, 180, 22] });
    box("capture-buffer-bind", "newobj", { text: "prepend ode_audio_buffer", numinlets: 1, numoutlets: 1, outlettype: [""], patching_rect: [470, 420, 180, 22] });
    line("capture-buffer-name", 0, "capture-buffer-bind");
    line("capture-buffer-bind", 0, "client");
    box("capture-recorder", "newobj", { text: "record~ #0-odeCapture 2", varname: "odeCaptureRecorder", numinlets: 4, numoutlets: 1, outlettype: ["signal"], patching_rect: [250, 520, 180, 22] });
    box("capture-dsp", "newobj", { text: "dspstate~", numinlets: 1, numoutlets: 4, outlettype: ["int", "float", "int", "int"], patching_rect: [660, 480, 80, 22] });
    box("capture-sync", "newobj", { text: "plugsync~", numinlets: 1, numoutlets: 9, patching_rect: [660, 520, 100, 22] });
    for (const [id, source, index, method] of [
      ["dsp", "capture-dsp", 0, "ode_audio_dsp"], ["rate", "capture-dsp", 1, "ode_audio_rate"],
      ["beat", "capture-sync", 6, "ode_audio_beat"], ["sample", "capture-sync", 7, "ode_audio_sample"],
      ["flags", "capture-sync", 8, "ode_audio_flags"],
    ] as const) {
      box(`capture-${id}-message`, "newobj", { text: `prepend ${method}`, numinlets: 1, numoutlets: 1, outlettype: [""], patching_rect: [450, 550, 180, 22] });
      line(source, index, `capture-${id}-message`);
      line(`capture-${id}-message`, 0, "client");
    }
    box("name", "comment", { text: t("common.ode"), fontsize: 18, textcolor: [0.94, 0.94, 0.94, 1], presentation: 1, presentation_rect: [12, 10, 180, 25], patching_rect: [20, 20, 180, 25] });
    box("open", "textbutton", { text: t("live.menu.open"), texton: t("live.menu.open"), mode: 0, parameter_enable: 0, numinlets: 1, numoutlets: 3, outlettype: ["", "int", ""], presentation: 1, presentation_rect: [12, 45, 180, 30], patching_rect: [20, 60, 180, 30] });
    box("open-message", "message", { text: "open_ode", numinlets: 2, numoutlets: 1, outlettype: [""], patching_rect: [20, 105, 75, 22] });
    box("status", "comment", { text: t("max.connecting"), varname: "odeStatus", linecount: 3, numinlets: 1, numoutlets: 0, presentation: 1, presentation_rect: [12, 87, 184, 58], patching_rect: [20, 145, 184, 58], textcolor: [0.74, 0.74, 0.74, 1], fontsize: 11 });
    box("client", "v8.codebox", { code: script, filename: "none", numinlets: 2, numoutlets: 1, outlettype: [""], patching_rect: [250, 20, 500, 300], saved_object_attributes: { parameter_enable: 0 } });
    box("ready", "newobj", { text: "live.thisdevice", numinlets: 1, numoutlets: 3, outlettype: ["bang", "int", "int"], patching_rect: [20, 320, 100, 22] });
    box("start", "message", { text: "start", numinlets: 2, numoutlets: 1, outlettype: [""], patching_rect: [20, 355, 40, 22] });
    box("free", "newobj", { text: "freebang", numinlets: 1, numoutlets: 1, outlettype: ["bang"], patching_rect: [130, 320, 65, 22] });
    box("stop", "message", { text: "stop", numinlets: 2, numoutlets: 1, outlettype: [""], patching_rect: [130, 355, 40, 22] });
    line("open", 0, "open-message");
    line("open-message", 0, "client");
    line("ready", 0, "start");
    line("ready", 0, "capture-dsp");
    line("ready", 0, "capture-buffer-name");
    line("start", 0, "client");
    line("free", 0, "stop");
    line("stop", 0, "client");
    box("window-control", "newobj", { text: "pcontrol", numinlets: 1, numoutlets: 1, outlettype: [""], patching_rect: [250, 355, 65, 22] });
    box("window", "newobj", {
      text: "p Ode", varname: "odeWindow", numinlets: 1, numoutlets: 1, outlettype: [""], patching_rect: [250, 400, 65, 22],
      patcher: {
        fileversion: 1, appversion: MaxDevice.appVersion, classnamespace: "box", rect: [180, 100, 1080, 740],
        openinpresentation: 1, bglocked: 1, locked_bgcolor: [0.13, 0.13, 0.13, 1], bgcolor: [0.13, 0.13, 0.13, 1],
        toolbarvisible: 0, statusbarvisible: 0, enablehscroll: 0, enablevscroll: 0, title: t("common.ode"),
        boxes: [
          { box: { id: "in", maxclass: "inlet", numinlets: 0, numoutlets: 1, outlettype: [""], patching_rect: [20, 800, 30, 30] } },
          { box: { id: "browser", maxclass: "jweb", varname: "odeBrowser", numinlets: 1, numoutlets: 1, outlettype: [""], patching_rect: [0, 0, 1080, 740], presentation: 1, presentation_rect: [0, 0, 1080, 740], url: "about:blank", historysize: 0 } },
          { box: { id: "control", maxclass: "newobj", text: "thispatcher", varname: "odeWindowControl", numinlets: 1, numoutlets: 2, outlettype: ["", ""], patching_rect: [20, 760, 75, 22] } },
          { box: { id: "out", maxclass: "newobj", text: "outlet", numinlets: 1, numoutlets: 0, patching_rect: [110, 760, 45, 22] } },
        ],
        lines: [{ patchline: { source: ["browser", 0], destination: ["out", 0] } }],
      },
    });
    line("client", 0, "window-control");
    line("window-control", 0, "window");
    line("window", 0, "client", 1);
    const names = MAX_WINDOW.parameterNames;
    [names.signature, names.port, ...names.words, names.latch].forEach((name, index) => {
      const signature = name === names.signature;
      box(`connection-${index}`, "live.numbox", {
        varname: name, numinlets: 1, numoutlets: 2, outlettype: ["", "float"], parameter_enable: 1, parameter_mappable: 0,
        patching_rect: [800, 20 + index * 30, 120, 22],
        saved_attribute_attributes: {
          valueof: {
            parameter_longname: name, parameter_shortname: name, parameter_type: 0, parameter_unitstyle: 0,
            parameter_mmin: 0, parameter_mmax: signature ? 1 : 65535,
            parameter_initial: [signature ? MAX_WINDOW.version : 0], parameter_initial_enable: 1,
            parameter_invisible: 4, parameter_visible_undoable: 0,
          },
        },
      });
    });
    return {
      patcher: {
        fileversion: 1, appversion: MaxDevice.appVersion, classnamespace: "box", rect: [100, 100, 950, 600],
        openrect: [0, 0, 208, 169], openinpresentation: 1, bglocked: 1, devicewidth: 208,
        bgcolor: [0.17, 0.17, 0.17, 1], locked_bgcolor: [0.17, 0.17, 0.17, 1],
        default_fontname: "Arial", default_fontsize: 12, toolbarvisible: 0, statusbarvisible: 0,
        enablehscroll: 0, enablevscroll: 0, title: t("common.ode"), latency: 0, boxes, lines,
        parameters: { ...Object.fromEntries([names.signature, names.port, ...names.words, names.latch].map((name, index) => [`connection-${index}`, [name, name, 0]])), inherited_shortname: 1 },
        dependency_cache: [],
        project: { version: 1, viewrect: [0, 0, 300, 500], autoorganize: 1, hideprojectwindow: 1, showdependencies: 1, autolocalize: 0, contents: { patchers: {} }, layout: {}, searchpath: {}, detailsvisible: 0 },
      },
    };
  }

  private static readonly appVersion = { major: 9, minor: 1, revision: 5, architecture: "x64", modernui: 1 };
}
