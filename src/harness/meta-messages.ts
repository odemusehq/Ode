import type { AgentMedia } from "./agent-media";

/** Only the provider wire format changes. Claude Agent SDK still owns the complete agent loop. */
type Block = Record<string, any>;
export interface MessagesRequest extends Block { model: string; messages: { role: string; content: string | Block[] }[] }

export class MetaMessages {
  static request(body: MessagesRequest, media: AgentMedia): Block {
    const input: Block[] = [];
    const blocks = (value: string | Block[] | undefined): Block[] => typeof value === "string" ? [{ type: "text", text: value }] : value ?? [];
    // Meta's typed-message route failed the recorded music comparison. Its documented
    // shorthand preserved the sound, including when the original waveforms were swapped.
    if (body.system) input.push({ role: "system", content: blocks(body.system).map(block => ({ type: "input_text", text: String(block.text ?? "") })) });
    for (let index = 0; index < body.messages.length;) {
      const message = body.messages[index]!;
      if (message.role === "assistant") {
        for (const block of blocks(message.content)) {
          if (block.type === "tool_use") input.push({ type: "function_call", call_id: block.id, name: block.name, arguments: JSON.stringify(block.input ?? {}) });
          else if (block.type === "redacted_thinking") input.push({ type: "reasoning", summary: [], encrypted_content: block.data ?? block.redacted_thinking });
          else if (block.type === "text") input.push({ role: "assistant", content: [{ type: "output_text", text: block.text }] });
          else if (block.type !== "thinking") throw new Error(`Unsupported SDK assistant block: ${block.type}`);
        }
        index++; continue;
      }
      if (message.role !== "user") {
        input.push({ role: message.role, content: blocks(message.content).map(block => ({ type: "input_text", text: String(block.text ?? "") })) });
        index++; continue;
      }
      // All tool results must precede the media user message, even when the SDK splits results across messages.
      const outputs: Block[] = [], content: Block[] = [], audio: Block[] = [];
      while (body.messages[index]?.role === "user") {
        for (const block of blocks(body.messages[index++]!.content)) {
          if (block.type === "tool_result") {
            const result: Block[] = [];
            for (const part of blocks(block.content)) {
              if (part.type === "text") {
                const extracted = media.extract(String(part.text ?? ""), block.tool_use_id);
                result.push({ type: "input_text", text: extracted.text });
                if (extracted.audio.length) audio.push({ type: "input_text", text: `Recording returned by tool call ${block.tool_use_id}:` }, ...extracted.audio);
              } else if (part.type === "input_audio") audio.push(part);
              else result.push(...MetaMessages.media(part));
            }
            outputs.push({ type: "function_call_output", call_id: block.tool_use_id,
              output: result.every(part => part.type === "input_text") ? result.map(part => part.text).join("\n") : result });
          } else if (block.type === "text") {
            const extracted = media.extract(String(block.text ?? ""));
            content.push({ type: "input_text", text: extracted.text });
            if (extracted.audio.length) audio.push({ type: "input_text", text: "Musician's audio reference:" }, ...extracted.audio);
          } else if (block.type === "input_audio") audio.push(block);
          else content.push(...MetaMessages.media(block));
        }
      }
      input.push(...outputs);
      if (content.length) input.push({ role: "user", content });
      if (audio.length) input.push({ role: "user", content: audio });
    }
    // In the exact audio replay, opaque pre-listening reasoning produced a wrong A/B
    // comparison. Rebuild audio turns from the visible conversation and original waveforms.
    const hasAudio = input.some(item => item.content?.some((part: Block) => part.type === "input_audio"));
    const request: Block = { model: body.model, input: hasAudio ? input.filter(item => item.type !== "reasoning") : input,
      store: false, include: ["reasoning.encrypted_content"] };
    if (body.max_tokens !== undefined) request.max_output_tokens = body.max_tokens;
    if (body.output_config?.effort) request.reasoning = { effort: body.output_config.effort };
    if (body.output_config?.format) request.text = { format: body.output_config.format };
    if (body.tools?.length) request.tools = body.tools.map((tool: Block) => {
      if (!tool.type || tool.type === "custom") return { type: "function", name: tool.name, description: tool.description,
        parameters: tool.input_schema ?? tool.parameters, ...(tool.strict === undefined ? {} : { strict: tool.strict }) };
      if (["web_search", "web_search_20250305", "web_search_20250305_15"].includes(tool.type)) return { type: "web_search", ...(tool.user_location ? { user_location: tool.user_location } : {}) };
      throw new Error(`Unsupported SDK hosted tool: ${tool.type}`);
    });
    if (body.tool_choice?.type === "tool") request.tool_choice = { type: "function", name: body.tool_choice.name };
    else if (body.tool_choice?.type) request.tool_choice = ({ auto: "auto", any: "required", none: "none" } as Block)[body.tool_choice.type] ?? "auto";
    if (body.tool_choice?.disable_parallel_tool_use) request.parallel_tool_calls = false;
    return request;
  }

  private static media(block: Block): Block[] {
    const source = block.source;
    if (block.type === "image" && source?.type === "base64") return [{ type: "input_image", image_url: `data:${source.media_type};base64,${source.data}` }];
    if (block.type === "image" && source?.type === "url") return [{ type: "input_image", image_url: source.url }];
    if (block.type === "image" && source?.type === "file") return [{ type: "input_image", file_id: source.file_id }];
    if (block.type === "document") {
      if (source?.type === "base64") return [{ type: "input_file", filename: "reference.pdf", file_data: `data:${source.media_type};base64,${source.data}` }];
      if (source?.type === "file") return [{ type: "input_file", file_id: source.file_id }];
      if (source?.type === "url") return [{ type: "input_file", file_url: source.url }];
      if (source?.type === "text") return [{ type: "input_text", text: source.data }];
      if (source?.type === "content") return [{ type: "input_text", text: typeof source.content === "string" ? source.content : JSON.stringify(source.content) }];
    }
    if (block.type === "search_result" || block.type === "tool_reference") return [{ type: "input_text", text: JSON.stringify(block) }];
    throw new Error(`Unsupported SDK media block: ${block.type}`);
  }

  static message(response: Block): Block {
    if (response.status === "failed" || response.error) throw new Error(response.error?.message ?? "The provider request failed.");
    const content: Block[] = [];
    let tools = false;
    for (const item of response.output ?? []) {
      if (item.type === "reasoning" && item.encrypted_content) content.push({ type: "redacted_thinking", data: item.encrypted_content });
      if (item.type === "message") for (const part of item.content ?? []) {
        if (part.type === "output_text") content.push({ type: "text", text: part.text });
        else if (part.type === "refusal") content.push({ type: "text", text: part.refusal });
      }
      if (item.type === "function_call" && response.status !== "incomplete" && item.status !== "incomplete") {
        const input: unknown = JSON.parse(item.arguments);
        if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("The provider returned invalid tool arguments.");
        content.push({ type: "tool_use", id: item.call_id, name: item.name, input }); tools = true;
      }
    }
    const usage = response.usage ?? {}, cached = usage.input_tokens_details?.cached_tokens ?? 0;
    return { type: "message", id: response.id, role: "assistant", model: response.model, content,
      stop_reason: response.status === "incomplete" ? "max_tokens" : tools ? "tool_use" : "end_turn", stop_sequence: null,
      usage: { input_tokens: Math.max(0, (usage.input_tokens ?? 0) - cached), cache_read_input_tokens: cached,
        cache_creation_input_tokens: 0, output_tokens: usage.output_tokens ?? 0 } };
  }
}
