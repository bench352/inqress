import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MutableRefObject,
} from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import LinkIcon from "@mui/icons-material/Link";
import { EditorContent, useEditor } from "@tiptap/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { ApiError, useApi } from "../../../api";
import {
  FIELD_TRIGGER,
  LETTER_FIELDS,
  letterExtensionList,
} from "./letter/extensions";
import { allowedUrl, docToMarkdown, markdownToDoc } from "./letter/markdown";

interface Props {
  open: boolean;
  eventId: string;
  onClose: () => void;
}

function LetterForm({
  eventId,
  initialText,
  onClose,
  closeEditorRef,
}: {
  eventId: string;
  initialText: string;
  onClose: () => void;
  closeEditorRef: MutableRefObject<(() => void) | null>;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("sm"));
  const [fieldMenu, setFieldMenu] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkSubmitted, setLinkSubmitted] = useState(false);
  const [toolbarBottom, setToolbarBottom] = useState<number | null>(null);

  useEffect(() => {
    const onTrigger = (event: Event) => {
      const detail = (event as CustomEvent<{ top: number; left: number }>)
        .detail;
      setFieldMenu(detail);
    };
    window.addEventListener(FIELD_TRIGGER, onTrigger);
    return () => window.removeEventListener(FIELD_TRIGGER, onTrigger);
  }, []);

  useEffect(() => {
    if (isDesktop) return;
    const vv = (window as unknown as { visualViewport?: VisualViewport })
      .visualViewport;
    if (!vv) return;
    const update = () => setToolbarBottom(window.innerHeight - vv.height);
    vv.addEventListener("resize", update);
    update();
    return () => vv.removeEventListener("resize", update);
  }, [isDesktop]);

  const editor = useEditor({
    extensions: letterExtensionList,
    content: markdownToDoc(initialText),
    immediatelyRender: true,
    shouldRerenderOnTransaction: true,
  });

  useEffect(() => {
    closeEditorRef.current = () => {
      if (!editor.isDestroyed) editor.destroy();
    };
    return () => {
      closeEditorRef.current = null;
    };
  }, [editor, closeEditorRef]);

  const saveMutation = useMutation({
    mutationFn: async (text: string) => {
      await api.put(`/api/events/${eventId}/emailTemplate`, { text });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailTemplate", eventId] });
      onClose();
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError
          ? String(err.detail)
          : "Failed to save message template";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  const currentMarkdown = () => docToMarkdown(editor.getJSON());

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
    <>
      <DialogContent sx={{ pb: toolbarBottom !== null ? 10 : undefined }}>
        <DialogContentText sx={{ mb: 2 }}>
          Write the message. Insert a field from the toolbar. A short InQRess
          footer is added only when this is sent by email.
        </DialogContentText>
        <Stack spacing={2}>
          <Box
            sx={
              toolbarBottom !== null
                ? {
                    position: "fixed",
                    left: 0,
                    right: 0,
                    bottom: toolbarBottom,
                    bgcolor: "background.paper",
                    borderTop: 1,
                    borderColor: "divider",
                    p: 1,
                    zIndex: 1,
                  }
                : undefined
            }
          >
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
                Insert field
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
                color: "textSecondary",
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
        </Stack>
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
        <Dialog open={linkOpen} onClose={closeLink}>
          <DialogTitle>Add link</DialogTitle>
          <DialogContent>
            <Box
              component="form"
              id="add-link-form"
              onSubmit={handleLinkSubmit}
              noValidate
            >
              <TextField
                autoFocus
                margin="dense"
                label="URL"
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
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={closeLink}>
              Cancel
            </Button>
            <Button type="submit" form="add-link-form">
              Add
            </Button>
          </DialogActions>
        </Dialog>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saveMutation.isPending}>
          Cancel
        </Button>
        <Button
          onClick={() => saveMutation.mutate(currentMarkdown())}
          variant="contained"
          loading={saveMutation.isPending}
        >
          Save
        </Button>
      </DialogActions>
    </>
  );
}

export default function MessageTemplateDialog({
  open,
  eventId,
  onClose,
}: Props) {
  const api = useApi();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("sm"));
  const closeEditorRef = useRef<(() => void) | null>(null);
  const requestClose = () => {
    closeEditorRef.current?.();
    onClose();
  };
  const templateQuery = useQuery({
    queryKey: ["emailTemplate", eventId],
    queryFn: () =>
      api.get<{ text: string }>(`/api/events/${eventId}/emailTemplate`),
    enabled: open,
  });

  return (
    <Dialog
      open={open}
      onClose={requestClose}
      maxWidth="lg"
      fullWidth
      fullScreen={!isDesktop}
    >
      <DialogTitle>Message template</DialogTitle>
      {open && templateQuery.isLoading && (
        <DialogContent>
          <CircularProgress />
        </DialogContent>
      )}
      {open && templateQuery.isError && (
        <DialogContent>
          <Typography color="error">Failed to load template.</Typography>
        </DialogContent>
      )}
      {open && templateQuery.data && (
        <LetterForm
          eventId={eventId}
          initialText={templateQuery.data.text}
          onClose={requestClose}
          closeEditorRef={closeEditorRef}
        />
      )}
    </Dialog>
  );
}
