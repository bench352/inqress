import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ChatOutlinedIcon from "@mui/icons-material/ChatOutlined";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import SaveIcon from "@mui/icons-material/Save";
import { MuiColorInput } from "mui-color-input";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, useApi } from "../../api";
import { useSnackbar } from "notistack";
import type { EventItem } from "../eventsList/useEvents";
import FileUploadField from "@/components/FileUploadField";
import PageHeader from "@/components/PageHeader";
import SectionHeading from "@/components/SectionHeading";
import CoverScreen, {
  DEFAULT_KIOSK_MESSAGE,
} from "../companion/kiosk/CoverScreen";

/** The kiosk at its design size, scaled down to whatever width it gets. */
function KioskCoverPreview({
  eventName,
  message,
  accentColor,
  coverUrl,
}: {
  eventName?: string;
  message: string;
  accentColor: string;
  coverUrl: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      ref={ref}
      role="img"
      aria-label="Preview of the kiosk screen"
      sx={{
        aspectRatio: "16 / 9",
        position: "relative",
        overflow: "hidden",
        borderRadius: 1,
        border: 1,
        borderColor: "divider",
      }}
    >
      {width > 0 && (
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1920,
            height: 1080,
            transform: `scale(${width / 1920})`,
            transformOrigin: "top left",
            pointerEvents: "none",
          }}
        >
          <CoverScreen
            eventName={eventName}
            message={message}
            accentColor={accentColor}
            coverUrl={coverUrl}
            onPhone={() => {}}
            onEmail={() => {}}
          />
        </Box>
      )}
    </Box>
  );
}

function errorDetail(error: unknown): string {
  const detail =
    error instanceof ApiError
      ? String(error.detail)
      : "Could not reach the server";
  return detail.replace(/\.$/, "") + ".";
}

export default function CustomizeBooth() {
  const { eventId } = useParams({
    from: "/app-shell/admin/events/$eventId/customizeKiosk",
  });
  const navigate = useNavigate();
  const api = useApi();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [removePending, setRemovePending] = useState(false);
  const [accentDraft, setAccentDraft] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const eventQuery = useQuery<EventItem>({
    queryKey: ["event", eventId],
    queryFn: () => api.get(`/api/events/${eventId}`),
    enabled: !!eventId,
  });

  const accentColorQuery = useQuery<{ colorCode: string }>({
    queryKey: ["accentColor", eventId],
    queryFn: () => api.get(`/api/events/${eventId}/accentColor`),
    enabled: !!eventId,
  });
  const kioskMessageQuery = useQuery<{ message: string }>({
    queryKey: ["kioskMessage", eventId],
    queryFn: () => api.get(`/api/admin/events/${eventId}/kiosk/message`),
    enabled: !!eventId,
  });

  const currentAccentColor =
    accentDraft ?? accentColorQuery.data?.colorCode ?? "#000000";
  const currentMessage = messageDraft ?? kioskMessageQuery.data?.message ?? "";

  useEffect(() => {
    if (!eventQuery.data?.hasBoothImage) return;

    let cancelled = false;
    let blobUrl: string | null = null;
    api
      .getBlob(`/api/events/${eventId}/boothImage`)
      .then((blob) => {
        if (cancelled) return;
        blobUrl = URL.createObjectURL(blob);
        setImageUrl(blobUrl);
      })
      .catch(() => {
        if (!cancelled) setImageUrl(null);
      });

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [eventId, eventQuery.data?.hasBoothImage, api]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const clearSelection = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setRemovePending(false);
    setSaveError(null);
  };

  const handleRemoveClick = () => {
    setSaveError(null);
    clearSelection();
    setRemovePending(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    const tasks: { section: string; run: () => Promise<void> }[] = [];

    if (selectedFile) {
      tasks.push({
        section: "Cover image",
        run: async () => {
          const formData = new FormData();
          formData.append("file", selectedFile);
          await api.postFormData(`/api/events/${eventId}/boothImage`, formData);
          setImageUrl(URL.createObjectURL(selectedFile));
          clearSelection();
          setRemovePending(false);
          void queryClient.invalidateQueries({
            queryKey: ["event", eventId],
          });
        },
      });
    } else if (removePending) {
      tasks.push({
        section: "Cover image",
        run: async () => {
          await api.del(`/api/events/${eventId}/boothImage`);
          setImageUrl(null);
          clearSelection();
          setRemovePending(false);
          void queryClient.invalidateQueries({
            queryKey: ["event", eventId],
          });
        },
      });
    }

    tasks.push({
      section: "Accent color",
      run: async () => {
        await api.put(`/api/events/${eventId}/accentColor`, {
          colorCode: currentAccentColor,
        });
        void queryClient.invalidateQueries({
          queryKey: ["accentColor", eventId],
        });
      },
    });
    tasks.push({
      section: "Message for guests",
      run: async () => {
        const message = currentMessage.trim();
        await api.put(`/api/admin/events/${eventId}/kiosk/message`, {
          message,
        });
        setMessageDraft(message);
        void queryClient.invalidateQueries({
          queryKey: ["kioskMessage", eventId],
        });
      },
    });

    const results = await Promise.allSettled(tasks.map((task) => task.run()));
    const failures: string[] = [];
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        failures.push(`${tasks[index].section}: ${errorDetail(result.reason)}`);
      }
    });

    if (failures.length > 0) {
      const savedSome = results.some((result) => result.status === "fulfilled");
      setSaveError(
        `Some settings were not saved. ${failures.join(" ")} ${
          savedSome ? "The other settings were saved." : "Nothing was saved."
        }`,
      );
    } else {
      enqueueSnackbar("Kiosk settings saved.", { variant: "success" });
    }
    setSaving(false);
  };

  if (
    eventQuery.isLoading ||
    accentColorQuery.isLoading ||
    kioskMessageQuery.isLoading
  ) {
    return <LinearProgress />;
  }

  const ready = !!(
    eventQuery.data &&
    accentColorQuery.data &&
    kioskMessageQuery.data
  );
  const displayUrl = removePending ? null : (previewUrl ?? imageUrl);

  return (
    <Stack spacing={2} sx={{ maxWidth: 960 }}>
      <PageHeader
        title="Kiosk customization"
        subtitle={eventQuery.data?.name}
        onBack={() =>
          navigate({
            to: "/admin/events/$eventId/settings",
            params: { eventId },
          })
        }
      />

      {!ready && (
        <Alert severity="error">
          Could not load the kiosk settings. Refresh to try again.
        </Alert>
      )}

      <KioskCoverPreview
        eventName={eventQuery.data?.name}
        message={currentMessage}
        accentColor={currentAccentColor}
        coverUrl={displayUrl}
      />

      <Stack spacing={2}>
        <SectionHeading icon={<CloudUploadIcon />}>Cover image</SectionHeading>
        <FileUploadField
          accept="image/png,image/jpeg,image/gif,image/webp"
          formats="PNG, JPEG, GIF, or WebP"
          prompt="Upload image"
          previewUrl={displayUrl}
          previewAlt="Kiosk cover image"
          onFileSelect={handleFileSelect}
          disabled={saving}
        />
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          {(previewUrl || imageUrl) && !removePending && (
            <Button
              color="error"
              startIcon={<DeleteIcon />}
              disabled={saving}
              onClick={handleRemoveClick}
            >
              Remove image
            </Button>
          )}
        </Stack>
      </Stack>

      <Stack spacing={2}>
        <SectionHeading icon={<PaletteOutlinedIcon />}>
          Accent color
        </SectionHeading>
        <Typography variant="body1" color="textSecondary">
          Used for icons and buttons on the kiosk screen.
        </Typography>
        <MuiColorInput
          format="hex"
          value={currentAccentColor}
          onChange={setAccentDraft}
          disabled={saving}
        />
      </Stack>

      <Stack spacing={2}>
        <SectionHeading icon={<ChatOutlinedIcon />}>
          Message for guests
        </SectionHeading>
        <Typography variant="body1" color="textSecondary">
          Shown on the kiosk cover. Leave blank to use the default message.
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={2}
          value={currentMessage}
          onChange={(e) => setMessageDraft(e.target.value)}
          placeholder={DEFAULT_KIOSK_MESSAGE}
          disabled={saving}
        />
      </Stack>

      {saveError && <Alert severity="error">{saveError}</Alert>}

      <Box>
        <Button
          variant="contained"
          size="large"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          loading={saving}
          disabled={!ready}
        >
          Save
        </Button>
      </Box>
    </Stack>
  );
}
