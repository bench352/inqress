import { Chip } from "@mui/material";
import { Extension, InputRule, Node } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { allowedUrl } from "./markdown";

export const LETTER_FIELDS = [
  { name: "title", label: "Title" },
  { name: "fullName", label: "Full name" },
  { name: "eventName", label: "Event name" },
  { name: "senderName", label: "Sender name" },
] as const;

const FIELD_LABEL: Record<string, string> = Object.fromEntries(
  LETTER_FIELDS.map((field) => [field.name, field.label]),
);

const FIELD_PATTERN = /\{\{\s*(title|fullName|eventName|senderName)\s*\}\}$/;

// eslint-disable-next-line react-refresh/only-export-components
function MergeFieldView({ node, selected }: ReactNodeViewProps) {
  const name = String(node.attrs.name ?? "");
  const bold = node.marks.some((mark) => mark.type.name === "bold");
  const italic = node.marks.some((mark) => mark.type.name === "italic");
  return (
    <NodeViewWrapper as="span">
      <Chip
        component="span"
        label={FIELD_LABEL[name] ?? name}
        size="small"
        variant={selected ? "filled" : "outlined"}
        color="primary"
        sx={{
          mx: 0.25,
          verticalAlign: "middle",
          "& .MuiChip-label": {
            fontWeight: bold ? 700 : 400,
            fontStyle: italic ? "italic" : "normal",
          },
        }}
      />
    </NodeViewWrapper>
  );
}

export const MergeField = Node.create({
  name: "mergeField",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      name: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-merge-field]" }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MergeFieldView);
  },
  addInputRules() {
    return [
      new InputRule({
        find: FIELD_PATTERN,
        handler: ({ state, range, match }) => {
          const name = match[1];
          if (!name) return;
          const node = state.schema.nodes.mergeField?.create({ name });
          if (!node) return;
          state.tr.replaceWith(range.from, range.to, node);
        },
      }),
    ];
  },
});

export const TicketQr = Node.create({
  name: "ticketQr",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: "div[data-ticket-qr]" }];
  },
  renderHTML() {
    return [
      "div",
      { "data-ticket-qr": "true", class: "ticket-qr" },
      "QR ticket",
    ];
  },
});

export const FIELD_TRIGGER = "inqress-field-trigger";

export function createFieldTrigger() {
  return Extension.create({
    name: "fieldTrigger",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey("fieldTrigger"),
          props: {
            handleTextInput(view, from, _to, text) {
              const prev = view.state.doc.textBetween(
                Math.max(0, from - 1),
                from,
              );
              if (text === "{" && prev === "{") {
                requestAnimationFrame(() => {
                  const coords = view.coordsAtPos(view.state.selection.from);
                  window.dispatchEvent(
                    new CustomEvent(FIELD_TRIGGER, {
                      detail: { top: coords.bottom, left: coords.left },
                    }),
                  );
                });
              }
              return false;
            },
          },
        }),
      ];
    },
  });
}

export function letterExtensions() {
  return [
    StarterKit.configure({
      heading: false,
      code: false,
      codeBlock: false,
      blockquote: false,
      strike: false,
      horizontalRule: false,
      link: false,
    }),
    Link.configure({
      openOnClick: false,
      autolink: false,
      linkOnPaste: false,
      isAllowedUri: (url) => allowedUrl(url),
    }),
    MergeField,
    TicketQr,
    createFieldTrigger(),
  ];
}

export const letterExtensionList = letterExtensions();
