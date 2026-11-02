import { Blob, File, atob, btoa } from "node:buffer";
import { webcrypto } from "node:crypto";
import { ReadableStream, TransformStream, WritableStream } from "node:stream/web";
import { clearImmediate, setImmediate } from "node:timers";
import { URL, URLSearchParams } from "node:url";
import { TextDecoder, TextEncoder } from "node:util";
import { deserialize, serialize } from "node:v8";

/**
 * Live's extension host runs an extension with a smaller set of globals than Node gives a script: fetch, Buffer,
 * timers and AbortController are there, while TextEncoder, URL, Blob, web streams, structuredClone and a few more are
 * left to the extension. This module fills those in from Node's own modules; extension.ts imports it first, so every
 * library finds them when it loads.
 */
class HostGlobals {
  private static readonly FROM_NODE: Readonly<Record<string, unknown>> = {
    global: globalThis,
    TextEncoder,
    TextDecoder,
    URL,
    URLSearchParams,
    Blob,
    File,
    ReadableStream,
    WritableStream,
    TransformStream,
    setImmediate,
    clearImmediate,
    atob,
    btoa,
    crypto: webcrypto,
    // Node's default abort reason retains its native constructor even when Live omits the global.
    DOMException: (() => {
      const controller = new AbortController();
      controller.abort();
      return controller.signal.reason.constructor;
    })(),
    // AbortSignal is an EventTarget, so the host's own EventTarget sits right behind it.
    EventTarget: Object.getPrototypeOf(AbortSignal),
    queueMicrotask: (task: () => void) => void Promise.resolve().then(task),
    structuredClone: (value: unknown) => deserialize(serialize(value)),
  };

  /** Adds each global the host left out; the host's own ones stay as they are. */
  static fill(): void {
    for (const [name, value] of Object.entries(HostGlobals.FROM_NODE)) {
      if (!(name in globalThis)) Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
    }
  }
}

HostGlobals.fill();
