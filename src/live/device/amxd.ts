/** A Max for Live device file: "ampf" header, device type, meta chunk, then the patch (null-terminated). */
export class AmxdFile {
  private static readonly HEADER_BYTES = 32;
  /** Where the header stores the length of the patch. */
  private static readonly PATCH_LENGTH_OFFSET = 28;
  private static readonly PATCH_END = "\n\0";

  /** A device file holding the patch (JSON text). */
  static pack(patch: string): Buffer {
    const body = Buffer.from(`${patch}${AmxdFile.PATCH_END}`, "utf8");
    const header = Buffer.alloc(AmxdFile.HEADER_BYTES);
    header.write("ampf", 0, "ascii");
    header.writeUInt32LE(4, 4);
    header.write("aaaa", 8, "ascii");
    header.write("meta", 12, "ascii");
    header.writeUInt32LE(4, 16);
    header.writeUInt32LE(0, 20);
    header.write("ptch", 24, "ascii");
    header.writeUInt32LE(body.length, AmxdFile.PATCH_LENGTH_OFFSET);
    return Buffer.concat([header, body]);
  }

  /** The patch (JSON text) in a device file. */
  static unpack(file: Buffer): string {
    const length = file.readUInt32LE(AmxdFile.PATCH_LENGTH_OFFSET);
    const body = file.subarray(AmxdFile.HEADER_BYTES, AmxdFile.HEADER_BYTES + length).toString("utf8");
    return body.endsWith(AmxdFile.PATCH_END) ? body.slice(0, -AmxdFile.PATCH_END.length) : body;
  }
}
