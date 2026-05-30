import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ImageIcon from "@mui/icons-material/Image";
import QrCodeIcon from "@mui/icons-material/QrCode";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../../../api";

interface Props {
  open: boolean;
  eventId: string;
  hasBoothImage: boolean;
  onClose: () => void;
}

export default function BoothImageConfigDialog({
  open,
  eventId,
  hasBoothImage,
  onClose,
}: Props) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const didFetch = useRef(false);

  useEffect(() => {
    if (!open) {
      didFetch.current = false;
      return;
    }
    if (didFetch.current) return;
    didFetch.current = true;

    if (!hasBoothImage) return;

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
  }, [open, hasBoothImage, api, eventId]);

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

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      await api.postFormData(`/api/events/${eventId}/boothImage`, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      onClose();
    },
  });

  const handleSubmit = () => {
    if (!selectedFile) return;
    uploadMutation.mutate(selectedFile);
  };

  const displayUrl = previewUrl || imageUrl;
  const isUploading = uploadMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Configure Check-in Booth Image</DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          <Paper
            elevation={4}
            sx={{
              aspectRatio: "16 / 9",
              display: "flex",
              overflow: "hidden",
              borderRadius: 1,
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
              }}
            >
              {displayUrl ? (
                <Box
                  component="img"
                  src={displayUrl}
                  alt="Booth preview"
                  sx={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              ) : (
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <ImageIcon sx={{ fontSize: 64, color: "grey.400" }} />
                  <Typography variant="body2" color="text.secondary">
                    No image
                  </Typography>
                </Box>
              )}
            </Box>
            <Box
              sx={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "white",
              }}
            >
              <QrCodeIcon sx={{ fontSize: 80, color: "primary.main" }} />
            </Box>
          </Paper>
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
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isUploading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          loading={isUploading}
          disabled={!selectedFile}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
