import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import OpenAI from "openai";
import sharp from "sharp";
import type { RoleConfig } from "../shared/config";

/** Image generation over an OpenAI-compatible /images/generations endpoint (Meta's included). */
export class ImageGeneration {
  private readonly client: OpenAI;

  constructor(private readonly role: RoleConfig) {
    this.client = new OpenAI({ baseURL: role.baseUrl, apiKey: role.apiKey });
  }

  /** Generates a square image and writes it as a PNG of `size` × `size` pixels. */
  async square(prompt: string, outPath: string, size: number): Promise<string> {
    const response = await this.client.images.generate({
      model: this.role.model,
      prompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    });
    const encoded = response.data?.[0]?.b64_json;
    if (!encoded) throw new Error("The image model returned no image.");
    await mkdir(dirname(outPath), { recursive: true });
    await sharp(Buffer.from(encoded, "base64")).resize(size, size, { fit: "cover", kernel: "lanczos3" }).png().toFile(outPath);
    return outPath;
  }
}
