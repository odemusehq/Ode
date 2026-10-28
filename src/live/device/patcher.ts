/** Builds the Max patch of the Ode device: audio passes through untouched; the device adds Ode's window and Live access. */

interface Box {
  box: Record<string, unknown>;
}

interface Line {
  patchline: { source: [string, number]; destination: [string, number] };
}

export interface DevicePatcherOptions {
  /** JavaScript run by the v8.codebox (Live side). */
  liveCode: string;
  /** Absolute path of the network side's script for node.script. */
  nodeScript: string;
  /** Address of Ode's UI on the local server. */
  uiUrl: string;
}

export class DevicePatcher {
  /** Live's device height in pixels. */
  private static readonly DEVICE_HEIGHT = 169;
  private static readonly DEVICE_WIDTH = 480;
  private static readonly BUTTON_WIDTH = 88;
  private static readonly BUTTON_HEIGHT = 22;
  /** Space above the first button and between buttons. */
  private static readonly BUTTON_GAP = 8;
  /** The compact strip fills the device left of the button column. */
  private static readonly STRIP_WIDTH = DevicePatcher.DEVICE_WIDTH - DevicePatcher.BUTTON_WIDTH - 8;
  /** Wide enough for the lyrics panel beside History. */
  private static readonly WINDOW_SIZE: [number, number] = [760, 860];
  /** Max patcher value for an audio effect device ("aaaa"). */
  private static readonly AUDIO_EFFECT_TYPE = 1633771873;
  /** live.text mode of a momentary button that sends a bang. */
  private static readonly LIVE_TEXT_BUTTON_MODE = 0;
  /**
   * live.text transition that sends the bang when a press is released (One->Zero), so the control is
   * back at 0 when Ode reads the Set, which includes this device's own parameters.
   */
  private static readonly BANG_ON_RELEASE = 1;
  /** Max parameter type of a control with named states. */
  private static readonly ENUM_PARAMETER = 2;

  private readonly boxes: Box[] = [];
  private readonly lines: Line[] = [];

  constructor(private readonly options: DevicePatcherOptions) {}

  build(): object {
    this.newObject("plugin", "plugin~", 2, ["signal", "signal"], [40, 30, 60, 22]);
    this.newObject("plugout", "plugout~", 2, ["signal", "signal"], [40, 330, 60, 22]);
    this.newObject("ready", "live.thisdevice", 1, ["bang", "int", "int"], [420, 30, 90, 22]);
    this.add("live", {
      maxclass: "v8.codebox",
      code: this.options.liveCode,
      filename: "none",
      fontname: "Menlo",
      fontsize: 11,
      numinlets: 1,
      numoutlets: 2,
      outlettype: ["", ""],
      patching_rect: [420, 80, 320, 120],
      saved_object_attributes: { parameter_enable: 0 },
    });
    this.newObject("network", `node.script "${this.options.nodeScript}" @autostart 1 @watch 0`, 1, ["", ""], [760, 80, 380, 22]);
    this.newObject("recorder-route", "route buffer record", 2, ["", "", ""], [420, 230, 130, 22]);
    this.newObject("buffer", "buffer~ ---ode-measure 1000 2", 1, ["float", "bang"], [420, 270, 180, 22]);
    this.newObject("record", "record~ ---ode-measure 2", 4, ["signal"], [40, 200, 160, 22]);
    this.add("view", {
      maxclass: "jweb",
      url: `${this.options.uiUrl}/?view=compact`,
      rendermode: 2,
      numinlets: 1,
      numoutlets: 1,
      outlettype: [""],
      patching_rect: [40, 400, 360, DevicePatcher.DEVICE_HEIGHT],
      presentation: 1,
      presentation_rect: [0, 0, DevicePatcher.STRIP_WIDTH, DevicePatcher.DEVICE_HEIGHT],
    });
    this.add("open-button", {
      maxclass: "textbutton",
      text: "Open Ode window",
      numinlets: 1,
      numoutlets: 3,
      outlettype: ["", "", "int"],
      patching_rect: [760, 230, 120, 22],
      presentation: 1,
      presentation_rect: DevicePatcher.buttonRect(0),
    });
    this.newObject("open-message", "t open", 1, [""], [760, 270, 50, 22]);
    this.newObject("window-control", "pcontrol", 1, [""], [760, 310, 60, 22]);
    this.add("window", {
      maxclass: "newobj",
      text: "p ode-window",
      numinlets: 1,
      numoutlets: 0,
      patching_rect: [760, 350, 100, 22],
      patcher: this.windowPatcher(),
    });
    this.commandControl("again", "Again", "Ode tries its last change again: a different take, in place.", 1, [900, 230]);
    this.commandControl("undo", "Undo", "Goes back to the version before Ode's last change.", 2, [1020, 230]);

    this.connect("plugin", 0, "plugout", 0);
    this.connect("plugin", 1, "plugout", 1);
    this.connect("plugin", 0, "record", 0);
    this.connect("plugin", 1, "record", 1);
    this.connect("ready", 0, "live", 0);
    this.connect("network", 0, "live", 0);
    this.connect("live", 0, "network", 0);
    this.connect("live", 1, "recorder-route", 0);
    this.connect("recorder-route", 0, "buffer", 0);
    this.connect("recorder-route", 1, "record", 0);
    this.connect("open-button", 0, "open-message", 0);
    this.connect("open-message", 0, "window-control", 0);
    this.connect("window-control", 0, "window", 0);

    return {
      patcher: {
        fileversion: 1,
        appversion: { major: 9, minor: 1, revision: 5, architecture: "x64", modernui: 1 },
        classnamespace: "box",
        rect: [100, 100, 1180, 640],
        openrect: [0, 0, DevicePatcher.DEVICE_WIDTH, DevicePatcher.DEVICE_HEIGHT],
        openinpresentation: 1,
        default_fontsize: 10,
        default_fontname: "Arial Bold",
        devicewidth: DevicePatcher.DEVICE_WIDTH,
        description: "Ode: co-writer and co-producer inside Live.",
        boxes: this.boxes,
        lines: this.lines,
        dependency_cache: [],
        latency: 0,
        project: { version: 1, amxdtype: DevicePatcher.AUDIO_EFFECT_TYPE, readonly: 0, devpathtype: 0, devpath: ".", contents: { patchers: {} } },
        autosave: 0,
      },
    };
  }

  /** A floating window holding the full Ode UI; it stays above Live like a sidebar. */
  private windowPatcher(): object {
    const [width, height] = DevicePatcher.WINDOW_SIZE;
    return {
      fileversion: 1,
      classnamespace: "box",
      rect: [80, 80, 80 + width, 80 + height],
      openinpresentation: 1,
      toolbarvisible: 0,
      statusbarvisible: 0,
      boxes: [
        { box: { id: "w-inlet", maxclass: "inlet", numinlets: 0, numoutlets: 1, outlettype: [""], patching_rect: [20, 20, 30, 30] } },
        {
          box: {
            id: "w-view",
            maxclass: "jweb",
            url: `${this.options.uiUrl}/?view=full`,
            rendermode: 2,
            numinlets: 1,
            numoutlets: 1,
            outlettype: [""],
            patching_rect: [20, 120, width, height],
            presentation: 1,
            presentation_rect: [0, 0, width, height],
          },
        },
        { box: { id: "w-load", maxclass: "newobj", text: "loadbang", numinlets: 1, numoutlets: 1, outlettype: ["bang"], patching_rect: [200, 20, 60, 22] } },
        {
          box: {
            id: "w-float",
            maxclass: "message",
            text: "window flags float, window exec",
            numinlets: 2,
            numoutlets: 1,
            outlettype: [""],
            patching_rect: [200, 50, 200, 22],
          },
        },
        { box: { id: "w-this", maxclass: "newobj", text: "thispatcher", numinlets: 1, numoutlets: 2, outlettype: ["", ""], patching_rect: [200, 80, 80, 22] } },
      ],
      lines: [
        { patchline: { source: ["w-load", 0], destination: ["w-float", 0] } },
        { patchline: { source: ["w-float", 0], destination: ["w-this", 0] } },
      ],
    };
  }

  /**
   * A Live control that sends "command <name>" to the Live side each time a press is released. It is a
   * Live parameter, so the musician can map it to a key or a MIDI controller.
   */
  private commandControl(name: string, label: string, annotation: string, row: number, [x, y]: [number, number]): void {
    const control = `${name}-control`;
    const message = `${name}-message`;
    this.add(control, {
      maxclass: "live.text",
      mode: DevicePatcher.LIVE_TEXT_BUTTON_MODE,
      transition: DevicePatcher.BANG_ON_RELEASE,
      text: label,
      texton: label,
      automation: label,
      automationon: label,
      annotation,
      varname: label,
      parameter_enable: 1,
      saved_attribute_attributes: {
        valueof: {
          parameter_longname: label,
          parameter_shortname: label,
          parameter_type: DevicePatcher.ENUM_PARAMETER,
          parameter_mmax: 1,
          parameter_enum: [label, label],
        },
      },
      numinlets: 1,
      numoutlets: 2,
      outlettype: ["", ""],
      patching_rect: [x, y, 60, 20],
      presentation: 1,
      presentation_rect: DevicePatcher.buttonRect(row),
    });
    this.add(message, {
      maxclass: "message",
      text: `command ${name}`,
      numinlets: 2,
      numoutlets: 1,
      outlettype: [""],
      patching_rect: [x, y + 40, 100, 22],
    });
    this.connect(control, 0, message, 0);
    this.connect(message, 0, "live", 0);
  }

  /** A row of the button column right of the strip; row 0 is at the top. */
  private static buttonRect(row: number): number[] {
    const top = DevicePatcher.BUTTON_GAP + row * (DevicePatcher.BUTTON_HEIGHT + DevicePatcher.BUTTON_GAP);
    return [DevicePatcher.STRIP_WIDTH + 4, top, DevicePatcher.BUTTON_WIDTH, DevicePatcher.BUTTON_HEIGHT];
  }

  private newObject(id: string, text: string, inlets: number, outlets: string[], rect: number[]): void {
    this.add(id, { maxclass: "newobj", text, numinlets: inlets, numoutlets: outlets.length, outlettype: outlets, patching_rect: rect });
  }

  private add(id: string, attributes: Record<string, unknown>): void {
    this.boxes.push({ box: { id, ...attributes } });
  }

  private connect(source: string, outlet: number, destination: string, inlet: number): void {
    this.lines.push({ patchline: { source: [source, outlet], destination: [destination, inlet] } });
  }
}
