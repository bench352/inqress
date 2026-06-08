import { LinearProgress, Paper, Stack, Typography } from "@mui/material";

interface ProgressData {
  inProgress: boolean;
  numCompleted: number;
  numTotal: number;
  estRemainMin: number | null;
  numErrors: number;
}

interface Props {
  title: string;
  progress: ProgressData | null;
}

export default function ProgressCard({ title, progress }: Props) {
  if (!progress?.inProgress) return null;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Typography variant="subtitle1">{title}</Typography>
        <LinearProgress
          variant="determinate"
          value={
            progress.numTotal > 0
              ? (progress.numCompleted / progress.numTotal) * 100
              : 0
          }
        />
        <Stack direction="row" sx={{ justifyContent: "space-between" }}>
          <Typography variant="body1" color="text.secondary">
            {progress.numCompleted} / {progress.numTotal} {title.toLowerCase()}{" "}
            completed
            {progress.numErrors > 0 && (
              <>
                {" "}
                ({progress.numErrors} error
                {progress.numErrors !== 1 ? "s" : ""})
              </>
            )}
          </Typography>
          {progress.estRemainMin != null && (
            <Typography variant="body1" color="text.secondary">
              Estimated {progress.estRemainMin} minute
              {progress.estRemainMin !== 1 ? "s" : ""} remaining.
            </Typography>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
