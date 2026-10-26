import { useRef, useState, type DragEvent } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { useAppInfo } from "@/providers/useAppInfo";

interface Props {
  accept: string;
  formats: string;
  prompt: string;
  onFileSelect: (file: File) => void;
  previewUrl?: string | null;
  previewAlt?: string;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
}

function matchesAccept(file: File, accept: string): boolean {
  const rules = accept
    .split(",")
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean);
  if (rules.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return rules.some((rule) => {
    if (rule.startsWith(".")) return name.endsWith(rule);
    if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

export default function FileUploadField({
  accept,
  formats,
  prompt,
  onFileSelect,
  previewUrl,
  previewAlt,
  disabled = false,
  loading = false,
  loadingText = "Uploading…",
}: Props) {
  const { maxUploadMb } = useAppInfo();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = disabled || loading;

  const selectFiles = (files: File[]) => {
    if (files.length !== 1) {
      setError(
        files.length === 0
          ? "Select a file to upload."
          : "Select one file at a time.",
      );
      return;
    }
    const file = files[0];
    if (!matchesAccept(file, accept)) {
      setError(`Unsupported file. Choose ${formats}.`);
      return;
    }
    if (file.size > maxUploadMb * 1024 * 1024) {
      setError(`That file is larger than ${maxUploadMb} MB.`);
      return;
    }
    setError(null);
    onFileSelect(file);
  };

  const endDrag = () => {
    dragDepth.current = 0;
    setDragActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    endDrag();
    if (blocked) return;
    selectFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
      {previewUrl !== undefined && (
        <Box
          sx={{
            position: "relative",
            width: { xs: 112, sm: 160 },
            aspectRatio: "16 / 9",
            flexShrink: 0,
            overflow: "hidden",
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            bgcolor: "action.hover",
          }}
        >
          {previewUrl ? (
            <Box
              component="img"
              src={previewUrl}
              alt={previewAlt ?? "Selected image"}
              sx={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <Stack
              aria-label="No cover image"
              sx={{
                height: "100%",
                alignItems: "center",
                justifyContent: "center",
                color: "text.secondary",
              }}
            >
              <ImageOutlinedIcon fontSize="small" />
              <Typography variant="caption">No image</Typography>
            </Stack>
          )}
        </Box>
      )}

      <Stack spacing={0.5} sx={{ minWidth: 0, flexGrow: 1 }}>
        <Button
          component="label"
          role="button"
          tabIndex={blocked ? -1 : 0}
          aria-disabled={blocked}
          variant="outlined"
          onDragEnter={(event) => {
            event.preventDefault();
            if (blocked) return;
            dragDepth.current += 1;
            setDragActive(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => {
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0) setDragActive(false);
          }}
          onDrop={handleDrop}
          onClick={(event) => {
            if (blocked) event.preventDefault();
          }}
          onKeyDown={(event) => {
            if (blocked) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          sx={{
            width: "100%",
            minHeight: 88,
            px: 2,
            py: 1.5,
            textTransform: "none",
            borderWidth: 2,
            borderStyle: "dashed",
            borderColor: dragActive ? "primary.main" : "divider",
            bgcolor: dragActive ? "action.hover" : undefined,
            "&:hover": {
              borderWidth: 2,
              borderColor: "primary.main",
              bgcolor: "action.hover",
            },
            "& > *": { pointerEvents: "none" },
          }}
        >
          <Stack spacing={0.5} sx={{ alignItems: "center" }}>
            {loading ? (
              <CircularProgress size={20} />
            ) : (
              <CloudUploadIcon color="action" fontSize="small" />
            )}
            <Typography
              variant="body1"
              color="textSecondary"
              sx={{ fontWeight: 500 }}
            >
              {loading ? loadingText : prompt}
            </Typography>
            <Typography
              variant="caption"
              color={error ? "error" : "textSecondary"}
              role={error ? "alert" : undefined}
            >
              {error ? error : `${formats} · Up to ${maxUploadMb} MB`}
            </Typography>
          </Stack>
          <input
            ref={inputRef}
            type="file"
            name="file"
            accept={accept}
            hidden
            disabled={blocked}
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              selectFiles(files);
            }}
          />
        </Button>
      </Stack>
    </Stack>
  );
}
