import type { JSONContent } from "@tiptap/core";

const FIELDS = ["title", "fullName", "eventName", "senderName"] as const;

export function allowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

interface Marks {
  bold?: boolean;
  italic?: boolean;
  href?: string;
}

function isField(name: string): boolean {
  return (FIELDS as readonly string[]).includes(name);
}

function markList(marks: Marks): JSONContent["marks"] {
  const list: NonNullable<JSONContent["marks"]> = [];
  if (marks.bold) list.push({ type: "bold" });
  if (marks.italic) list.push({ type: "italic" });
  if (marks.href) list.push({ type: "link", attrs: { href: marks.href } });
  return list.length ? list : undefined;
}

function textNode(text: string, marks: Marks): JSONContent {
  return { type: "text", text, marks: markList(marks) };
}

function fieldNode(name: string, marks: Marks): JSONContent {
  return { type: "mergeField", attrs: { name }, marks: markList(marks) };
}

function readLink(
  src: string,
  start: number,
): { label: string; href: string; end: number } | null {
  const closeBracket = src.indexOf("](", start + 1);
  if (closeBracket === -1) return null;
  const closeParen = src.indexOf(")", closeBracket + 2);
  if (closeParen === -1) return null;
  const href = src.slice(closeBracket + 2, closeParen).trim();
  if (!allowedUrl(href)) return null;
  return {
    label: src.slice(start + 1, closeBracket),
    href,
    end: closeParen + 1,
  };
}

function parseInline(src: string, marks: Marks = {}): JSONContent[] {
  const nodes: JSONContent[] = [];
  let text = "";
  let i = 0;

  const flush = () => {
    if (!text) return;
    nodes.push(textNode(text, marks));
    text = "";
  };

  while (i < src.length) {
    if (src.startsWith("{{", i)) {
      const close = src.indexOf("}}", i + 2);
      if (close !== -1) {
        const name = src.slice(i + 2, close).trim();
        if (isField(name)) {
          flush();
          nodes.push(fieldNode(name, marks));
          i = close + 2;
          continue;
        }
      }
    }
    if (src.startsWith("**", i)) {
      const close = src.indexOf("**", i + 2);
      if (close !== -1) {
        flush();
        nodes.push(
          ...parseInline(src.slice(i + 2, close), { ...marks, bold: true }),
        );
        i = close + 2;
        continue;
      }
    }
    if (src[i] === "*" && !src.startsWith("**", i)) {
      const close = src.indexOf("*", i + 1);
      if (close !== -1) {
        flush();
        nodes.push(
          ...parseInline(src.slice(i + 1, close), { ...marks, italic: true }),
        );
        i = close + 1;
        continue;
      }
    }
    if (src[i] === "[") {
      const link = readLink(src, i);
      if (link) {
        flush();
        nodes.push(...parseInline(link.label, { ...marks, href: link.href }));
        i = link.end;
        continue;
      }
    }
    text += src[i];
    i += 1;
  }
  flush();
  return nodes;
}

function listItem(text: string): JSONContent {
  const content = parseInline(text);
  return {
    type: "listItem",
    content: [
      {
        type: "paragraph",
        content: content.length ? content : undefined,
      },
    ],
  };
}

function parseParagraph(lines: string[]): JSONContent[] {
  const nodes: JSONContent[] = [];
  lines.forEach((line, index) => {
    const hard = line.endsWith("  ");
    const body = hard ? line.slice(0, -2) : line;
    nodes.push(...parseInline(body));
    if (hard && index < lines.length - 1) {
      nodes.push({ type: "hardBreak" });
    }
  });
  return nodes;
}

function parseBlock(block: string): JSONContent {
  const trimmed = block.trim();
  if (/^\{\{\s*ticketQR\s*\}\}$/.test(trimmed)) {
    return { type: "ticketQr" };
  }
  const lines = block.split("\n");
  if (lines.every((line) => /^[-*] /.test(line.trim()))) {
    return {
      type: "bulletList",
      content: lines.map((line) => listItem(line.trim().replace(/^[-*] /, ""))),
    };
  }
  if (lines.every((line) => /^\d+\. /.test(line.trim()))) {
    return {
      type: "orderedList",
      content: lines.map((line) =>
        listItem(line.trim().replace(/^\d+\. /, "")),
      ),
    };
  }
  const content = parseParagraph(lines);
  return {
    type: "paragraph",
    content: content.length ? content : undefined,
  };
}

export function markdownToDoc(src: string): JSONContent {
  const normalized = src.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
  return {
    type: "doc",
    content: normalized.split(/\n{2,}/).map(parseBlock),
  };
}

function applyMarks(
  text: string,
  marks: NonNullable<JSONContent["marks"]>,
): string {
  let out = text;
  if (marks.some((mark) => mark.type === "italic")) out = `*${out}*`;
  if (marks.some((mark) => mark.type === "bold")) out = `**${out}**`;
  const link = marks.find((mark) => mark.type === "link");
  const href = link?.attrs?.href;
  if (typeof href === "string" && allowedUrl(href)) {
    out = `[${out}](${href})`;
  }
  return out;
}

function serializeInline(nodes: JSONContent[]): string {
  const parts: string[] = [];
  let i = 0;
  while (i < nodes.length) {
    const node = nodes[i];
    if (node.type === "hardBreak") {
      parts.push("  \n");
      i++;
      continue;
    }
    const marks = node.marks ?? [];
    let inner = "";
    let j = i;
    while (j < nodes.length) {
      const n = nodes[j];
      if (n.type === "hardBreak") break;
      const nm = n.marks ?? [];
      if (JSON.stringify(nm) !== JSON.stringify(marks)) break;
      if (n.type === "text") {
        inner += n.text ?? "";
      } else if (n.type === "mergeField") {
        const name = n.attrs?.name;
        inner += `{{ ${typeof name === "string" ? name : ""} }}`;
      } else if (n.content) {
        inner += serializeInline(n.content);
      }
      j++;
    }
    const leadingWs = inner.match(/^(\s*)/)?.[1] ?? "";
    const trailingWs = inner.match(/(\s*)$/)?.[1] ?? "";
    const core = inner.slice(
      leadingWs.length,
      inner.length - trailingWs.length,
    );
    const wrapped = core ? applyMarks(core, marks) : "";
    parts.push(leadingWs + wrapped + trailingWs);
    i = j;
  }
  return parts.join("");
}

function serializeListItem(node: JSONContent): string {
  const paragraph = node.content?.find((child) => child.type === "paragraph");
  return serializeInline(paragraph?.content ?? []);
}

function serializeBlock(node: JSONContent): string {
  if (node.type === "ticketQr") return "{{ ticketQR }}";
  if (node.type === "bulletList") {
    return (node.content ?? [])
      .map((item) => `- ${serializeListItem(item)}`)
      .join("\n");
  }
  if (node.type === "orderedList") {
    return (node.content ?? [])
      .map((item, index) => `${index + 1}. ${serializeListItem(item)}`)
      .join("\n");
  }
  return serializeInline(node.content ?? []);
}

export function docToMarkdown(doc: JSONContent): string {
  const blocks = (doc.content ?? []).map(serializeBlock);
  const text = blocks.join("\n\n").trim();
  return text ? `${text}\n` : "";
}
