import { useEffect, useState, type FormEvent } from "react";
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import LinkIcon from "@mui/icons-material/Link";
import { EditorContent, useEditor } from "@tiptap/react";
import AppDialog from "@/components/AppDialog";
import {
  FIELD_TRIGGER,
  LETTER_FIELDS,
  letterExtensionList,
} from "./letter/extensions";
import { allowedUrl, docToMarkdown, markdownToDoc } from "./letter/markdown";

interface Props {
  initialText: string;
  onChange: (markdown: string) => void;
}

export default function MessageTemplateEditor({
  initialText,
  onChange,
}: Props) {
  const [fieldMenu, setFieldMenu] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkSubmitted, setLinkSubmitted] = useState(false);

  useEffect(() => {
    const onTrigger = (event: Event) => {
      const detail = (event as CustomEvent<{ top: number; left: number }>)
        .detail;
      setFieldMenu(detail);
    };
    window.addEventListener(FIELD_TRIGGER, onTrigger);
    return () => window.removeEventListener(FIELD_TRIGGER, onTrigger);
  }, []);

  const editor = useEditor({
    extensions: letterExtensionList,
    content: markdownToDoc(initialText),
    immediatelyRender: true,
    shouldRerenderOnTransaction: true,
  });

  useEffect(() => {
    if (!editor) return;
    const update = () => onChange(docToMarkdown(editor.getJSON()));
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor, onChange]);

  const insertField = (name: string) => {
    const from = editor.state.selection.from;
    const before = editor.state.doc.textBetween(Math.max(0, from - 2), from);
    const chain = editor.chain().focus();
    if (before === "{{") {
      chain.deleteRange({ from: from - 2, to: from });
    }
    if (name === "ticketQR") {
      chain.insertContent({ type: "ticketQr" }).run();
    } else {
      chain.insertContent({ type: "mergeField", attrs: { name } }).run();
    }
    setFieldMenu(null);
  };

  const handleLinkSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLinkSubmitted(true);
    if (!linkUrl.trim() || !allowedUrl(linkUrl)) return;
    applyLink();
  };

  const closeLink = () => {
    setLinkOpen(false);
    setLinkSubmitted(false);
  };

  const applyLink = () => {
    if (!allowedUrl(linkUrl)) return;
    const { empty } = editor.state.selection;
    if (empty) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: linkUrl,
          marks: [{ type: "link", attrs: { href: linkUrl } }],
        })
        .run();
    } else {
      editor.chain().focus().setLink({ href: linkUrl }).run();
    }
    setLinkOpen(false);
    setLinkSubmitted(false);
    setLinkUrl("");
  };

  return (
    <Stack spacing={2}>
      <Box>
        <ToggleButtonGroup size="small" exclusive sx={{ flexWrap: "wrap" }}>
          <ToggleButton
            value="bold"
            selected={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            aria-label="Bold"
          >
            <FormatBoldIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="italic"
            selected={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            aria-label="Italic"
          >
            <FormatItalicIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="bullet"
            selected={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            aria-label="Bullet list"
          >
            <FormatListBulletedIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="number"
            selected={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            aria-label="Numbered list"
          >
            <FormatListNumberedIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="link"
            selected={editor.isActive("link")}
            onClick={() => {
              setLinkSubmitted(false);
              setLinkOpen(true);
            }}
            aria-label="Link"
          >
            <LinkIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="field"
            selected={false}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setFieldMenu({ top: rect.bottom, left: rect.left });
            }}
            aria-label="Insert field"
          >
            + Field
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Paper
        variant="outlined"
        sx={{
          "& .ProseMirror": {
            minHeight: 280,
            outline: "none",
            px: 2,
            py: 1.5,
            fontSize: 16,
          },
          "& .ProseMirror p": { my: 0, mb: 1.5 },
          "& .ticket-qr": {
            border: 1,
            borderStyle: "dashed",
            borderColor: "divider",
            borderRadius: 1,
            px: 2,
            py: 1.5,
            textAlign: "center",
          },
          "& .ticket-qr.ProseMirror-selectednode": {
            borderStyle: "solid",
            borderColor: "primary.main",
            color: "primary.main",
          },
        }}
      >
        <EditorContent editor={editor} />
      </Paper>
      <Menu
        open={fieldMenu !== null}
        onClose={() => setFieldMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          fieldMenu ? { top: fieldMenu.top, left: fieldMenu.left } : undefined
        }
      >
        {LETTER_FIELDS.map((field) => (
          <MenuItem key={field.name} onClick={() => insertField(field.name)}>
            {field.label}
          </MenuItem>
        ))}
        <MenuItem onClick={() => insertField("ticketQR")}>QR ticket</MenuItem>
      </Menu>
      <AppDialog
        open={linkOpen}
        onClose={closeLink}
        title="Add link"
        actions={
          <>
            <Button type="button" onClick={closeLink}>
              Cancel
            </Button>
            <Button type="submit" form="add-link-form">
              Add
            </Button>
          </>
        }
      >
        <Box
          component="form"
          id="add-link-form"
          onSubmit={handleLinkSubmit}
          noValidate
        >
          <TextField
            autoFocus
            label="Link"
            fullWidth
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            required
            helperText={
              linkSubmitted && !linkUrl.trim()
                ? "A link is required."
                : "Use an http, https, or mailto link."
            }
            error={
              (linkSubmitted && !linkUrl.trim()) ||
              (linkUrl.length > 0 && !allowedUrl(linkUrl))
            }
          />
        </Box>
      </AppDialog>
    </Stack>
  );
}
