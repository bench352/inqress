import {
  LinearProgress,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";

interface Props {
  steps: string[];
  activeStep: number;
}

export default function ResponsiveStepper({ steps, activeStep }: Props) {
  return (
    <>
      <Stepper
        activeStep={activeStep}
        sx={{ display: { xs: "none", sm: "flex" } }}
      >
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <Stack spacing={1} sx={{ display: { xs: "flex", sm: "none" } }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {steps[activeStep]}
        </Typography>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Typography
            variant="body1"
            color="textSecondary"
            noWrap
            sx={{ flexShrink: 0 }}
          >
            Step {activeStep + 1} of {steps.length}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={((activeStep + 1) / steps.length) * 100}
            aria-label={`Step ${activeStep + 1} of ${steps.length}`}
            sx={{ flex: 1 }}
          />
        </Stack>
      </Stack>
    </>
  );
}
