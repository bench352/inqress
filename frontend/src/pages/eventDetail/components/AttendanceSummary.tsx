import { Box, LinearProgress, Stack, Typography } from "@mui/material";

interface Props {
  totalCount: number;
  attendedCount: number;
}

export default function AttendanceSummary({
  totalCount,
  attendedCount,
}: Props) {
  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "flex-end" }}>
        <Stack direction="column" spacing={0} sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontSize: 18 }}>
            Attendance
          </Typography>
          <LinearProgress
            variant="determinate"
            value={totalCount > 0 ? (attendedCount / totalCount) * 100 : 0}
          />
        </Stack>
        <Typography
          variant="subtitle1"
          sx={{ whiteSpace: "nowrap", fontSize: 24 }}
        >
          {attendedCount} / {totalCount}
        </Typography>
      </Stack>
    </Box>
  );
}
