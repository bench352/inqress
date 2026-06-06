import { useCallback, useEffect, useRef, useState } from "react";
import Grid from "@mui/material/Grid";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  LinearProgress,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ImageIcon from "@mui/icons-material/Image";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import CheckIcon from "@mui/icons-material/Check";
import BackspaceIcon from "@mui/icons-material/Backspace";
import LoginIcon from "@mui/icons-material/Login";
import { MuiColorInput } from "mui-color-input";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, useApi } from "../../api";
import { useSnackbar } from "notistack";
import type { EventItem } from "../eventsList/useEvents";

const DIAL_DIGITS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

export default function CustomizeBooth() {
  const { eventId } = useParams({
    from: "/app-shell/events/$eventId/customizeBooth",
  });
  const navigate = useNavigate();
  const api = useApi();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const currentAccentColor =
    accentColor ?? accentColorQuery.data?.colorCode ?? "#000000";

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleColorChange = useCallback((newValue: string) => {
    setAccentColor(newValue);
  }, []);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const promises: Promise<void>[] = [];

      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        promises.push(
          api
            .postFormData(`/api/events/${eventId}/boothImage`, formData)
            .then(() => {}),
        );
      }

      promises.push(
        api
          .put(`/api/events/${eventId}/accentColor`, {
            colorCode: currentAccentColor,
          })
          .then(() => {}),
      );

      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      queryClient.invalidateQueries({ queryKey: ["accentColor", eventId] });
      navigate({ to: "/events/$eventId", params: { eventId } });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? String(err.detail) : "Failed to save changes";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  if (eventQuery.isLoading) {
    return <LinearProgress />;
  }

  const event = eventQuery.data;
  const displayUrl = previewUrl || imageUrl;
  const isSaving = uploadMutation.isPending;

  return (
    <Box sx={{ display: "flex", height: "calc(100vh - 64px)" }}>
      <Box sx={{ flex: "1 1 0", minWidth: 0, overflow: "auto", p: 4 }}>
        <Stack spacing={3}>
          <Typography variant="h4">{event?.name}</Typography>
          <Typography variant="h6" color="text.secondary">
            Customize check-in booth
          </Typography>

          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Choose a booth cover image
            </Typography>
            <Box
              onClick={() => fileInputRef.current?.click()}
              sx={{
                border: "2px dashed",
                borderColor: "divider",
                borderRadius: 1,
                p: 3,
                display: "flex",
                alignItems: "center",
                gap: 2,
                cursor: "pointer",
                "&:hover": {
                  borderColor: "primary.main",
                  bgcolor: "action.hover",
                },
              }}
            >
              <CloudUploadIcon color="action" sx={{ fontSize: 40 }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2">
                  {selectedFile
                    ? selectedFile.name
                    : "Click to select an image file"}
                </Typography>
                {!selectedFile && (
                  <Typography variant="caption" color="text.secondary">
                    PNG, JPEG or GIF
                  </Typography>
                )}
              </Box>
              {selectedFile && (
                <Button
                  variant="text"
                  size="small"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                  }}
                >
                  Remove
                </Button>
              )}
            </Box>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleFileSelect}
            />
          </Box>

          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Choose an accent color
            </Typography>
            <MuiColorInput
              format="hex"
              value={currentAccentColor}
              onChange={handleColorChange}
            />
          </Box>

          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              onClick={() => uploadMutation.mutate()}
              loading={isSaving}
            >
              Save Changes
            </Button>
            <Button
              variant="outlined"
              onClick={() =>
                navigate({ to: "/events/$eventId", params: { eventId } })
              }
              disabled={isSaving}
            >
              Cancel
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Box
        sx={{
          flex: "1 1 0",
          bgcolor: "grey.100",
          p: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          minHeight: 0,
          minWidth: 0,
          overflow: "auto",
        }}
      >
        <Paper
          elevation={2}
          sx={{
            aspectRatio: "16 / 9",
            display: "flex",
            overflow: "hidden",
            borderRadius: 1,
            width: "100%",
            maxWidth: 700,
          }}
        >
          <Box
            sx={{
              aspectRatio: "1 / 1",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "grey.200",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {displayUrl ? (
              <Box
                component="img"
                src={displayUrl}
                alt="Booth cover preview"
                sx={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <ImageIcon sx={{ fontSize: 48, color: "grey.400" }} />
            )}
          </Box>
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              bgcolor: "grey.50",
            }}
          >
            <Box
              sx={{
                aspectRatio: "16 / 9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "grey.100",
                overflow: "hidden",
              }}
            >
              <QrCodeScannerIcon
                sx={{ fontSize: 80, color: currentAccentColor }}
              />
            </Box>
            <Box
              sx={{
                flex: 1,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                p: 1.5,
              }}
            >
              <Button
                variant="contained"
                sx={{
                  bgcolor: currentAccentColor,
                  "&:hover": { bgcolor: currentAccentColor },
                  minWidth: "60%",
                  pointerEvents: "none",
                }}
                size="large"
              >
                <LoginIcon />
              </Button>
            </Box>
          </Box>
        </Paper>

        <Paper
          elevation={2}
          sx={{
            aspectRatio: "16 / 9",
            display: "flex",
            overflow: "hidden",
            borderRadius: 1,
            width: "100%",
            maxWidth: 700,
          }}
        >
          <Box
            sx={{
              aspectRatio: "1 / 1",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              bgcolor: "grey.100",
              flexShrink: 0,
            }}
          >
            <PhoneAndroidIcon
              sx={{ fontSize: 64, color: currentAccentColor }}
            />
          </Box>
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: 0.5,
              p: 1,
            }}
          >
            <Stack
              direction="row"
              spacing={0.5}
              sx={{ width: "100%", maxWidth: 280 }}
            >
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Code</InputLabel>
                <Select value="" label="Code" disabled />
              </FormControl>
              <TextField
                size="small"
                disabled
                sx={{ flex: 2 }}
                placeholder="Phone"
              />
            </Stack>
            <Grid container spacing={0.5} sx={{ maxWidth: 280 }}>
              {DIAL_DIGITS.flat().map((_, i) => (
                <Grid key={i} size={4}>
                  <Button
                    fullWidth
                    variant="contained"
                    sx={{
                      minHeight: 36,
                      minWidth: 0,
                      pointerEvents: "none",
                      bgcolor: currentAccentColor,
                      "&.Mui-disabled": {
                        bgcolor: currentAccentColor,
                        color: "#fff",
                      },
                    }}
                  />
                </Grid>
              ))}
              <Grid size={4}>
                <Button
                  fullWidth
                  variant="outlined"
                  sx={{
                    minHeight: 36,
                    minWidth: 0,
                    py: 0.8,
                    pointerEvents: "none",
                    borderColor: currentAccentColor,
                    color: currentAccentColor,
                  }}
                >
                  <BackspaceIcon fontSize="small" />
                </Button>
              </Grid>
              <Grid size={8}>
                <Button
                  fullWidth
                  variant="contained"
                  color="success"
                  sx={{
                    minHeight: 36,
                    minWidth: 0,
                    py: 0.8,
                    pointerEvents: "none",
                  }}
                >
                  <CheckIcon fontSize="small" />
                </Button>
              </Grid>
            </Grid>
            <Button
              variant="outlined"
              fullWidth
              sx={{
                maxWidth: 280,
                minHeight: 36,
                py: 0.8,
                pointerEvents: "none",
                borderColor: currentAccentColor,
                color: currentAccentColor,
              }}
            >
              <QrCodeScannerIcon fontSize="small" />
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
