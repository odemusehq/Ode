import { AudioFileDecoder } from "./decode";

function tag(bytes: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < 4; index++) bytes[offset + index] = value.charCodeAt(index);
}

function chunkHeader(name: string, size: number, littleEndian: boolean, extra = 0): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(8 + extra);
  tag(bytes, 0, name);
  new DataView(bytes.buffer).setUint32(4, size, littleEndian);
  return bytes;
}

function assemble(container: "WAV" | "AIFF" | "AIFC", parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const size = 12 + parts.reduce((total, part) => total + part.length, 0);
  if (size - 8 > 0xffffffff) throw new Error("The excerpt is too large for its audio container.");
  const bytes = new Uint8Array(size);
  tag(bytes, 0, container === "WAV" ? "RIFF" : "FORM");
  new DataView(bytes.buffer).setUint32(4, size - 8, container === "WAV");
  tag(bytes, 8, container === "WAV" ? "WAVE" : container);
  let offset = 12;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return bytes;
}

/** Copy selected source frames without changing sample bits. Ancillary markers/loop/tempo metadata is omitted. */
export function extractAudio(bytes: Uint8Array, firstFrame: number, endFrame: number) {
  const captured = Uint8Array.from(bytes);
  const decoder = new AudioFileDecoder();
  const layout = decoder.layout(captured, "Excerpt source");
  if (!Number.isSafeInteger(firstFrame) || !Number.isSafeInteger(endFrame) || firstFrame < 0 || endFrame <= firstFrame || endFrame > layout.info.frames) {
    throw new Error("Choose nonempty integer frame bounds inside the source, with an exclusive end.");
  }
  const firstByte = layout.frameOffset + firstFrame * layout.frameBytes;
  const endByte = layout.frameOffset + endFrame * layout.frameBytes;
  if (endByte > layout.frameOffset + layout.dataBytes || endByte > captured.length) throw new Error("The selected source frames are truncated.");
  const payload = captured.subarray(firstByte, endByte);
  if (layout.info.encoding === "float") {
    const width = layout.info.bitDepth / 8;
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    for (let offset = 0; offset < payload.length; offset += width) {
      const value = layout.info.bitDepth === 64 ? view.getFloat64(offset, layout.littleEndian) : view.getFloat32(offset, layout.littleEndian);
      if (!Number.isFinite(value)) throw new Error("The selected excerpt contains a nonfinite sample.");
    }
  }
  const padding = new Uint8Array(payload.length % 2);
  const count = endFrame - firstFrame;
  let outputBytes: Uint8Array<ArrayBuffer>;
  if (layout.container === "WAV") {
    const fact = layout.info.encoding === "float" ? chunkHeader("fact", 4, true, 4) : null;
    if (fact) new DataView(fact.buffer).setUint32(8, count, true);
    outputBytes = assemble("WAV", [layout.formatChunk, ...(fact ? [fact] : []), chunkHeader("data", payload.length, true), payload, padding]);
  } else {
    if (layout.container === "AIFC" && !layout.versionChunk) throw new Error("AIFC excerpt creation needs its format version chunk. Export the source as WAV or AIFF first.");
    if (layout.container === "AIFC" && new DataView(layout.versionChunk!.buffer, layout.versionChunk!.byteOffset, layout.versionChunk!.byteLength).getUint32(8, false) !== 0xa2805140) {
      throw new Error("This AIFC format version is unsupported. Export the source as WAV or AIFF first.");
    }
    if (layout.container === "AIFC") {
      const commonSize = new DataView(layout.formatChunk.buffer, layout.formatChunk.byteOffset, layout.formatChunk.byteLength).getUint32(4, false);
      if (commonSize < 23 || 23 + layout.formatChunk[30]! > commonSize) throw new Error("The AIFC compression name is incomplete. Export the source as WAV or AIFF first.");
    }
    const common = Uint8Array.from(layout.formatChunk);
    new DataView(common.buffer).setUint32(10, count, false);
    outputBytes = assemble(layout.container, [...(layout.versionChunk ? [layout.versionChunk] : []), common,
      chunkHeader("SSND", 8 + payload.length, false, 8), payload, padding]);
  }
  const output = decoder.inspect(outputBytes, "Excerpt");
  if (output.frames !== count || output.sampleRate !== layout.info.sampleRate || output.channels !== layout.info.channels ||
    output.bitDepth !== layout.info.bitDepth || output.encoding !== layout.info.encoding) throw new Error("The excerpt's original sample format could not be preserved.");
  return { bytes: outputBytes, source: layout.info, selection: { firstFrame, endFrame }, output, container: layout.container };
}
