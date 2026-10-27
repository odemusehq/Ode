import { Fragment } from "react";
import type { ReactNode } from "react";
import "./Markdown.css";

enum BlockKind {
  Paragraph = "paragraph",
  Heading = "heading",
  List = "list",
  Code = "code",
}

type Block =
  | { kind: BlockKind.Paragraph; lines: string[] }
  | { kind: BlockKind.Heading; text: string }
  | { kind: BlockKind.List; ordered: boolean; items: string[] }
  | { kind: BlockKind.Code; text: string };

interface ListItemMatch {
  ordered: boolean;
  text: string;
}

const FENCE = /^\s*```/;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s{0,3}#{1,6}\s+(.*)$/;
const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/;

export interface MarkdownProps {
  text: string;
}

/** Light Markdown: paragraphs, headings, lists, bold, inline code and code blocks. */
export function Markdown({ text }: MarkdownProps) {
  return (
    <div className="ode-md">
      {parseBlocks(text).map((block, index) => (
        <MarkdownBlock key={index} block={block} />
      ))}
    </div>
  );
}

/** The text without Markdown marks, on one line. */
export function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[^\n]*\n?/g, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*(?:[-*•]|\d+[.)]|#{1,6})\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface MarkdownBlockProps {
  block: Block;
}

function MarkdownBlock({ block }: MarkdownBlockProps) {
  switch (block.kind) {
    case BlockKind.Paragraph:
      return (
        <p>
          {block.lines.map((line, index) => (
            <Fragment key={index}>
              {index > 0 && <br />}
              {renderInline(line)}
            </Fragment>
          ))}
        </p>
      );
    case BlockKind.Heading:
      return <p className="ode-md__heading">{renderInline(block.text)}</p>;
    case BlockKind.List: {
      const items = block.items.map((item, index) => <li key={index}>{renderInline(item)}</li>);
      return block.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
    }
    case BlockKind.Code:
      return (
        <pre>
          <code>{block.text}</code>
        </pre>
      );
  }
}

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      index += 1;
    } else if (FENCE.test(line)) {
      const end = findFenceEnd(lines, index + 1);
      blocks.push({ kind: BlockKind.Code, text: lines.slice(index + 1, end).join("\n") });
      index = end + 1;
    } else if (HEADING.test(line)) {
      blocks.push({ kind: BlockKind.Heading, text: line.replace(HEADING, "$1") });
      index += 1;
    } else if (matchListItem(line)) {
      const list = readList(lines, index);
      blocks.push(list.block);
      index = list.next;
    } else {
      const paragraph = readParagraph(lines, index);
      blocks.push(paragraph.block);
      index = paragraph.next;
    }
  }
  return blocks;
}

function findFenceEnd(lines: readonly string[], from: number): number {
  for (let index = from; index < lines.length; index += 1) {
    if (FENCE.test(lines[index] ?? "")) return index;
  }
  return lines.length;
}

function readList(lines: readonly string[], from: number): { block: Block; next: number } {
  const first = matchListItem(lines[from] ?? "");
  const ordered = first?.ordered ?? false;
  const items: string[] = [];
  let index = from;
  while (index < lines.length) {
    const item = matchListItem(lines[index] ?? "");
    if (!item || item.ordered !== ordered) break;
    items.push(item.text);
    index += 1;
  }
  return { block: { kind: BlockKind.List, ordered, items }, next: index };
}

function readParagraph(lines: readonly string[], from: number): { block: Block; next: number } {
  const paragraph: string[] = [];
  let index = from;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim() === "" || FENCE.test(line) || HEADING.test(line) || matchListItem(line)) break;
    paragraph.push(line);
    index += 1;
  }
  return { block: { kind: BlockKind.Paragraph, lines: paragraph }, next: index };
}

function matchListItem(line: string): ListItemMatch | null {
  const bullet = BULLET.exec(line);
  if (bullet) return { ordered: false, text: bullet[1] ?? "" };
  const numbered = NUMBERED.exec(line);
  if (numbered) return { ordered: true, text: numbered[1] ?? "" };
  return null;
}

function renderInline(text: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter((part) => part !== "")
    .map((part, index) => {
      if (isWrapped(part, "**") || isWrapped(part, "__")) return <strong key={index}>{part.slice(2, -2)}</strong>;
      if (isWrapped(part, "`")) return <code key={index}>{part.slice(1, -1)}</code>;
      return part;
    });
}

function isWrapped(part: string, mark: string): boolean {
  return part.length > mark.length * 2 && part.startsWith(mark) && part.endsWith(mark);
}
