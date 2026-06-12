import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import MergeIcon from "@mui/icons-material/Merge";
import StrikethroughSIcon from "@mui/icons-material/StrikethroughS";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import WavesIcon from "@mui/icons-material/Waves";
import HelpOutlineIcon from "@mui/icons-material/HelpOutlined";
import MermaidDiagram from "./MermaidDiagram";

const DUPLICATE_STRATEGIES = [
  {
    value: "smartMerge",
    label: "Smart Merge",
    icon: MergeIcon,
    description:
      "The participant records with more detailed information will be kept. Recommended for most scenarios.",
  },
  {
    value: "overwrite",
    label: "Overwrite",
    icon: StrikethroughSIcon,
    description:
      "The new participant records will always overwrite the matching existing records. Use when your provided data is the source of truth.",
  },
  {
    value: "skip",
    label: "Skip",
    icon: SkipNextIcon,
    description:
      "The new participant records will be discarded in favor of existing records.",
  },
] as const;

const NAME_MATCH_MODES = [
  {
    value: "exact",
    label: "Exact Match",
    icon: FactCheckIcon,
    description:
      "Participants are considered matching if their full name is exactly the same. Use when your data source only appends new participant data without updating the names of existing ones. Recommended for most scenarios.",
  },
  {
    value: "fuzzy",
    label: "Match Similar Names",
    icon: WavesIcon,
    description:
      "Participants are considered matching if their full name is somewhat similar. Only use when your data source may correct existing participants' names.",
  },
] as const;

const DUPLICATE_FLOW_CHART = `graph TD
    A[New participant record] --> B{Name match?}
    B -->|Not a match| C[Create new record]
    B -->|It's a match| D{Contact info match?<br/>Email or phone}
    D -->|Not a match| C
    D -->|It's a match| E{Strategy?}
    E -->|Skip| F[Discard new record<br/>Keep existing]
    E -->|Overwrite| G[Replace existing record<br/>with new data]
    E -->|Smart Merge| H[Merge fields<br/>Keep more complete data]`;

const NAME_MATCH_FLOW_CHART = `graph TD
    A[Compare names] --> B{Mode?}
    B -->|Exact Match| C[Names are identical?]
    C -->|Yes, it's a match| D[Potential duplicate]
    C -->|No, not a match| E[Create new record]
    B -->|Match Similar Names| F[Similarity ≥ 85%?]
    F -->|Yes| D
    F -->|No| E`;

interface Props {
  strategy: string;
  onStrategyChange: (value: string) => void;
  nameMatchMode: string;
  onNameMatchModeChange: (value: string) => void;
}

function OptionCard({
  selected,
  onClick,
  icon: Icon,
  label,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  description: string;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        flex: 1,
        borderColor: selected ? "primary.main" : "divider",
        transition: "border-color 0.2s, background-color 0.2s",
      }}
    >
      <CardActionArea
        data-active={selected || undefined}
        onClick={onClick}
        sx={{
          p: 2,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-start",
          "&[data-active]": {
            bgcolor: "primary.50",
          },
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
          <Icon
            color={selected ? "primary" : "action"}
            sx={{ fontSize: 28, mt: 0.25 }}
          />
          <Stack spacing={0.5}>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: selected ? 600 : 400 }}
            >
              {label}
            </Typography>
            <Typography variant="body1" color="textSecondary">
              {description}
            </Typography>
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

export default function DataHandlingStep({
  strategy,
  onStrategyChange,
  nameMatchMode,
  onNameMatchModeChange,
}: Props) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <Stack spacing={3}>
      <Typography variant="body1">
        Choose how new participant data is combined with existing records. Pick
        the option that matches how the source data was created.
      </Typography>

      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Duplicate Handling Strategy
          </Typography>
          <Button
            variant="text"
            size="small"
            startIcon={<HelpOutlineIcon />}
            onClick={() => setHelpOpen(true)}
            sx={{ lineHeight: 1.25 }}
          >
            How are duplicates found?
          </Button>
        </Stack>
        <Stack direction="row" spacing={2}>
          {DUPLICATE_STRATEGIES.map((s) => (
            <OptionCard
              key={s.value}
              selected={strategy === s.value}
              onClick={() => onStrategyChange(s.value)}
              icon={s.icon}
              label={s.label}
              description={s.description}
            />
          ))}
        </Stack>
      </Stack>

      <Stack spacing={1.5}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Name Matching Strategy
        </Typography>
        <Stack direction="row" spacing={2}>
          {NAME_MATCH_MODES.map((m) => (
            <OptionCard
              key={m.value}
              selected={nameMatchMode === m.value}
              onClick={() => onNameMatchModeChange(m.value)}
              icon={m.icon}
              label={m.label}
              description={m.description}
            />
          ))}
        </Stack>
      </Stack>

      <Dialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>How are duplicates found?</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Typography variant="body1">
              When you add participants, the system checks whether each new
              record matches an existing participant. If a match is found, the
              duplicate handling strategy determines how to resolve it.
            </Typography>
            <Box sx={{ "& svg": { maxWidth: "100%", height: "auto" } }}>
              <MermaidDiagram chart={DUPLICATE_FLOW_CHART} />
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Name matching behavior
            </Typography>
            <Typography variant="body1">
              The first step is always a name comparison. Depending on your
              chosen strategy, names must either match exactly or just be
              similar (≥85% similarity).
            </Typography>
            <Box sx={{ "& svg": { maxWidth: "100%", height: "auto" } }}>
              <MermaidDiagram chart={NAME_MATCH_FLOW_CHART} />
            </Box>
            <Typography variant="body1" color="textSecondary">
              If a name match is found but both email and phone are missing, the
              name match alone is treated as a potential duplicate. Choose the
              strategy that best fits how your data was collected.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpOpen(false)} variant="contained">
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
