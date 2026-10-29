import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Jimp, JimpMime, ResizeStrategy } from "jimp";
import OpenAI from "openai";
import { OdeConfig, type RoleConfig } from "../../shared/config";
import type { ImageGenerator } from "../capabilities";

/** Image generation over an OpenAI-compatible /images/generations endpoint (Meta's included). */
export class OpenAiCompatibleImageGenerator implements ImageGenerator {
  private readonly client: OpenAI;

  constructor(private readonly role: RoleConfig) {
    this.client = new OpenAI({ baseURL: role.baseUrl, apiKey: role.apiKey });
  }

  async square(prompt: string, outPath: string, size: number): Promise<string> {
    const response = await this.client.images.generate({
      model: this.role.model,
      prompt,
      n: 1,
      size: OdeConfig.services.imageRequestSize as OpenAI.ImageGenerateParams["size"],
      response_format: "b64_json",
    });
    const encoded = response.data?.[0]?.b64_json;
    if (!encoded) throw new Error("The image model's answer was missing the image.");
    const image = await Jimp.read(Buffer.from(encoded, "base64"));
    image.cover({ w: size, h: size, mode: ResizeStrategy.BICUBIC });
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, await image.getBuffer(JimpMime.png));
    return outPath;
  }
}
