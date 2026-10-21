import { useState } from "react";
import { IconButton, InputAdornment, TextField } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

export default function CopyableField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setFailed(true);
      setTimeout(() => setFailed(false), 1500);
    }
  };

  return (
    <TextField
      fullWidth
      label={label}
      value={value}
      slotProps={{
        input: {
          readOnly: true,
          sx: { fontFamily: "monospace", fontSize: 13 },
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                edge="end"
                size="small"
                aria-label={`Copy ${label}`}
                onClick={handleCopy}
              >
                {copied ? (
                  <CheckIcon fontSize="small" color="success" />
                ) : (
                  <ContentCopyIcon
                    fontSize="small"
                    color={failed ? "error" : "inherit"}
                  />
                )}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
