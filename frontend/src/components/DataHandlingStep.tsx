import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardActionArea,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Checkbox,
  FormControlLabel,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import MergeIcon from "@mui/icons-material/Merge";
import StrikethroughSIcon from "@mui/icons-material/StrikethroughS";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import WavesIcon from "@mui/icons-material/Waves";
import HelpOutlineIcon from "@mui/icons-material/HelpOutlined";
import TableRowsIcon from "@mui/icons-material/TableRows";

const DUPLICATE_STRATEGIES = [
  {
    value: "smartMerge",
    label: "Smart Merge",
    icon: MergeIcon,
    description:
      "Matching records are combined. The app keeps the more complete details.",
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
      "The name must match exactly. A matching email or phone confirms it.",
  },
  {
    value: "fuzzy",
    label: "Match Similar Names",
    icon: WavesIcon,
    description:
      "A similar name matches only when the email or phone also matches. The corrected name is then kept.",
  },
] as const;

interface Props {
  strategy: string;
  onStrategyChange: (value: string) => void;
  nameMatchMode: string;
  onNameMatchModeChange: (value: string) => void;
  activateNew: boolean;
  onActivateNewChange: (value: boolean) => void;
  /** Present only on the data source page, where row tracking is available. */
  tracking?: string;
  onTrackingChange?: (value: string) => void;
}

const ROW_TRACKING = {
  value: "row",
  label: "Row tracking",
  icon: TableRowsIcon,
  description:
    "Each person keeps the row they came from. A later sync updates that same person, so a corrected name reaches the ticket they already hold.",
} as const;

const ROW_TRACKING_WARNING =
  "This matches people by row number. Sorting the sheet, or inserting or deleting a row above existing people, will write the wrong details onto tickets already issued. Use Skip, Smart Merge, or Overwrite if rows might move.";

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
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
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
  activateNew,
  onActivateNewChange,
  tracking,
  onTrackingChange,
}: Props) {
  const [helpOpen, setHelpOpen] = useState(false);
  const allowsRowTracking = !!onTrackingChange;
  const rowTracking = tracking === "row";

  return (
    <Stack spacing={3}>
      <Typography variant="body1">
        {rowTracking
          ? "Each row of the file is linked to the participant it created. Later syncs update those people in place."
          : "Choose how new participant data is combined with existing records. Pick the option that matches how the source data was created."}
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
        <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
          {DUPLICATE_STRATEGIES.map((s) => (
            <OptionCard
              key={s.value}
              selected={!rowTracking && strategy === s.value}
              onClick={() => {
                onTrackingChange?.("match");
                onStrategyChange(s.value);
              }}
              icon={s.icon}
              label={s.label}
              description={s.description}
            />
          ))}
          {allowsRowTracking && (
            <OptionCard
              selected={rowTracking}
              onClick={() => onTrackingChange(ROW_TRACKING.value)}
              icon={ROW_TRACKING.icon}
              label={ROW_TRACKING.label}
              description={ROW_TRACKING.description}
            />
          )}
        </Stack>
      </Stack>

      {rowTracking && <Alert severity="warning">{ROW_TRACKING_WARNING}</Alert>}

      {!rowTracking && (
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
      )}

      <Stack spacing={1.5}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          New Participant Admission
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Whether participants added in this import (who are not already on the
          event) are immediately allowed to check in.
        </Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={activateNew}
              onChange={(e) => onActivateNewChange(e.target.checked)}
            />
          }
          label="New participants can check in (otherwise they wait to be admitted)"
        />
      </Stack>

      <Dialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>How are duplicates found?</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            A row matches an existing person when the name rule agrees and the
            email or phone does not point at someone else. If the row could be
            more than one person, it is rejected. The strategy above then
            decides what to keep.
          </Typography>
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
