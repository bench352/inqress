import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import ImageIcon from "@mui/icons-material/Image";
import { useApi } from "../../../api";

interface Props {
  eventId: string;
  eventName: string;
  hasBoothImage: boolean;
}

export default function BoothImage({
  eventId,
  eventName,
  hasBoothImage,
}: Props) {
  const api = useApi();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasBoothImage) return;

    let cancelled = false;
    api
      .getBlob(`/api/events/${eventId}/boothImage`)
      .then((blob) => {
        if (!cancelled) {
          setImageUrl(URL.createObjectURL(blob));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setImageUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, hasBoothImage, api]);

  return (
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
      {imageUrl ? (
        <Box
          component="img"
          src={imageUrl}
          alt="Booth"
          sx={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      ) : (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <ImageIcon sx={{ fontSize: 64, color: "grey.400" }} />
          <Typography
            variant="h4"
            color="grey.500"
            sx={{ textAlign: "center", px: 4 }}
          >
            {eventName}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
