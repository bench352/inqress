import {
  Alert,
  Box,
  Card,
  CardActionArea,
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
import TableRowsIcon from "@mui/icons-material/TableRows";

const DUPLICATE_STRATEGIES = [
  {
    value: "smartMerge",
    label: "Smart merge",
    icon: MergeIcon,
    description:
      'Whichever has the more "complete" detail is kept. Recommended for most scenario.',
  },
  {
    value: "overwrite",
    label: "Overwrite",
    icon: StrikethroughSIcon,
    description:
      "The new record updates everything on the matching person. Use this when the data sheet is the source of truth.",
  },
  {
    value: "skip",
    label: "Skip",
    icon: SkipNextIcon,
    description:
      "The new record is ignored. The person already on the list keeps everything they have.",
  },
] as const;

const NAME_MATCH_MODES = [
  {
    value: "exact",
    label: "Exact match",
    icon: FactCheckIcon,
    description: "The name must match exactly, plus matching email or phone.",
  },
  {
    value: "fuzzy",
    label: "Match similar names",
    icon: WavesIcon,
    description:
      "When the name is similar enough to an existing person, and the email or phone also matches. The corrected one is kept.",
  },
] as const;

interface Props {
  strategy: string;
  onStrategyChange: (value: string) => void;
  nameMatchMode: string;
  onNameMatchModeChange: (value: string) => void;
  activateNew: boolean;
  onActivateNewChange: (value: boolean) => void;
  /** Present only on the data source page, where "New record" (row) tracking is available. */
  tracking?: string;
  onTrackingChange?: (value: string) => void;
}

const ROW_TRACKING = {
  value: "row",
  label: "Row tracking",
  icon: TableRowsIcon,
  description:
    "Each person keeps the record they came from. A later sync updates that same person, so a corrected name reaches the ticket they already hold.",
} as const;

const ROW_TRACKING_WARNING =
  "Records are matched by position. Sorting the sheet or adding a record above someone writes their details onto the wrong ticket. Don't pick this option when records might be rearranged in the data source.";

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
  const allowsRowTracking = !!onTrackingChange;
  const rowTracking = tracking === "row";

  return (
    <Stack spacing={3}>
      <Typography variant="body1">
        Choose what happens when a record matches someone already on the list.
      </Typography>

      <Stack spacing={1.5}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Matching strategy
        </Typography>

        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              lg: `repeat(${allowsRowTracking ? 4 : 3}, minmax(0, 1fr))`,
            },
          }}
        >
          {allowsRowTracking && (
            <OptionCard
              selected={rowTracking}
              onClick={() => onTrackingChange(ROW_TRACKING.value)}
              icon={ROW_TRACKING.icon}
              label={ROW_TRACKING.label}
              description={ROW_TRACKING.description}
            />
          )}
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
        </Box>
      </Stack>

      {rowTracking && <Alert severity="warning">{ROW_TRACKING_WARNING}</Alert>}

      {!rowTracking && (
        <Stack spacing={1.5}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Name matching
          </Typography>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
              },
            }}
          >
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
          </Box>
        </Stack>
      )}

      <Stack spacing={1.5}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          New participant admission
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Whether newly added people are admitted automatically, so their
          tickets are valid right away.
        </Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={activateNew}
              onChange={(e) => onActivateNewChange(e.target.checked)}
            />
          }
          label="Newly added people are admitted automatically"
        />
      </Stack>
    </Stack>
  );
}
