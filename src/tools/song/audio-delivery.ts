import { z } from "zod";
import { AudioDeliveryNameSchema } from "../../shared/audio-delivery";
import { defineTool, type AnyTool } from "../define";

function bounded<T>(value: T, maxChars: number): T {
  if (JSON.stringify(value).length > maxChars) throw new Error("This delivery detail exceeds the configured tool result limit. Use a shorter filename or increase the limit.");
  return value;
}

export const audioDeliveryTools: AnyTool[] = [
  defineTool({
    name: "audio_delivery_add",
    changes: "memory",
    mainAgentOnly: true,
    description: "Retain an exact supplied managed audio file for download in this song's saved chat. Give audioId from the managed library and an explicit download name including its original WAV/AIFF extension. The source must be nonempty supported PCM WAV/AIFF with finite samples. No transcoding, gain change, crop or new native export occurs. The immutable receipt binds exact bytes/hash, inspected format/frames and the original source/range declaration; it does not establish current Set sound, mastering quality, complete tails or stem alignment. A repeated accepted-exchange/source/name tuple reuses the verified retained file. Returns {delivery,linkWarning?}; a link warning preserves the actual retained file for recovery/listing. Main-only persistent file change follows Manual Apply; it never edits the Set.",
    input: { audioId: z.uuid(), name: AudioDeliveryNameSchema },
    describe: ({ name }) => `Delivery · retain ${name}`,
    run: ({ audioId, name }, ctx) => {
      if (!ctx.exchangeId) throw new Error("Retaining audio needs the current accepted request's exchange id.");
      const songId = ctx.song.songId;
      return ctx.deliveries.retain({ songId, exchangeId: ctx.exchangeId, audioId, name }, { signal: ctx.signal, maxResultChars: ctx.config.limits.toolResultMaxChars });
    },
  }),
  defineTool({
    name: "audio_delivery_list",
    changes: "none",
    description: "List immutable retained audio delivery refs for this song, optionally one accepted exchange. Read-only: no capture, audio copy, decoding or publishing. Follow nextOffset for more files. Download links belong to the saved original song/exchange; a receipt records retained bytes at publication, while the download checks the actual file again. Unreadable manifests are counted. This is not a native export or a mastering certification.",
    input: { exchangeId: z.string().min(1).max(1000).optional(), offset: z.number().int().min(0).max(100000).optional(), limit: z.number().int().min(1).max(20).optional() },
    run: async (input, ctx) => {
      const result = await ctx.deliveries.list(ctx.song.songId, input);
      const items = [...result.items];
      const page = () => ({ ...result, items, nextOffset: result.offset + items.length < result.total ? result.offset + items.length : null });
      while (items.length && JSON.stringify(page()).length > ctx.config.limits.toolResultMaxChars) items.pop();
      if (!items.length && result.items.length) throw new Error("One delivery ref exceeds the configured tool result limit. Increase that limit to read it.");
      return bounded(page(), ctx.config.limits.toolResultMaxChars);
    },
  }),
  defineTool({
    name: "audio_delivery_read",
    changes: "none",
    description: "Read one retained delivery manifest in this song by id: exact copy hash/length, original managed source and declared range/stage, accepted exchange and inspected whole-file format/rate/channels/frames/bit depth. Metadata-only; it does not rehash or play audio, and says nothing about later Set currentness, artistic quality, alignment or tail completeness. The authenticated download verifies its actual served bytes.",
    input: { id: z.uuid() },
    run: async ({ id }, ctx) => bounded(await ctx.deliveries.read(ctx.song.songId, id), ctx.config.limits.toolResultMaxChars),
  }),
];
