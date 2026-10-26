import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  AppBar,
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import { useNavigate } from "@tanstack/react-router";
import { alpha } from "@mui/material/styles";
import { Scanner as QrScanner } from "@yudiel/react-qr-scanner";
import { useCompanionApi } from "@/api";
import ResponsiveStepper from "@/components/ResponsiveStepper";

const STORAGE_KEY = "inqress.companions";
const STEPS = ["Pair device", "Choose mode"];

interface PairInfo {
  eventId: string;
  name: string;
  token: string;
}

function readPairHash(hash: string): {
  eventId: string;
  token: string;
} | null {
  if (!hash.startsWith("#v1.")) return null;
  const parts = hash.slice(1).split(".");
  if (parts.length !== 3) return null;
  const [, eventId, token] = parts;
  if (!eventId || !token) return null;
  return { eventId, token };
}

interface StoredCompanion {
  eventId: string;
  name: string;
  mode: "kiosk" | "scanner" | null;
  token: string;
}

const MODE_OPTIONS = [
  {
    value: "kiosk" as const,
    label: "Kiosk (guest-facing screen)",
    icon: DesktopWindowsIcon,
    description:
      "A screen facing the guest. Shows check-in status and lets guests check in with phone or email.",
  },
  {
    value: "scanner" as const,
    label: "Scanner (staff handheld)",
    icon: PhoneAndroidIcon,
    description:
      "A phone held by staff to scan guests' QR tickets at the door.",
  },
];

function asString(v: unknown): string {
  if (Array.isArray(v)) {
    const first = v[0] as { rawValue?: unknown } | undefined;
    return String(first?.rawValue ?? "");
  }
  return String(v ?? "");
}

function ModeOptionCard({
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
        borderColor: selected ? "primary.main" : "divider",
        transition: "border-color 0.2s, background-color 0.2s",
      }}
    >
      <CardActionArea
        data-active={selected || undefined}
        onClick={onClick}
        sx={{
          p: 2,
          display: "flex",
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

export default function CompanionJoin() {
  const navigate = useNavigate();
  const companionApi = useCompanionApi();
  const [activeStep, setActiveStep] = useState(0);
  const [pairInfo, setPairInfo] = useState<PairInfo | null>(null);
  const [selectedMode, setSelectedMode] = useState<"kiosk" | "scanner" | null>(
    null,
  );
  const [switchFrom, setSwitchFrom] = useState<"kiosk" | "scanner" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [manualEventId, setManualEventId] = useState("");
  const [manualSubmitted, setManualSubmitted] = useState(false);
  const manualEventIdError = manualSubmitted && !manualEventId.trim();
  const manualTokenError = manualSubmitted && !manualToken.trim();
  const [pendingPair] = useState(() => readPairHash(window.location.hash));
  const exchangingRef = useRef(false);

  const handleExchange = useCallback(
    async (eventId: string, token: string) => {
      if (exchangingRef.current) return;
      exchangingRef.current = true;
      setError(null);
      try {
        const res = await companionApi.postNoAuth<{
          eventId: string;
          name: string;
        }>("/api/companion/session", { event_id: eventId, token });
        setPairInfo({ eventId: res.eventId, name: res.name, token });
        setSelectedMode(null);
        setActiveStep(1);
      } catch (e: unknown) {
        const detail =
          e && typeof e === "object" && "detail" in e
            ? (e as { detail: unknown }).detail
            : null;
        setError(
          typeof detail === "string"
            ? detail
            : "Pairing failed — check the pairing token and event ID",
        );
      } finally {
        exchangingRef.current = false;
      }
    },
    [companionApi],
  );

  // Auto-exchange when the URL hash carries the pairing payload
  // (scanned from another device's camera, or Open on a mode-less device).
  useEffect(() => {
    if (!pendingPair) return;
    void (async () => {
      await handleExchange(pendingPair.eventId, pendingPair.token);
    })();
  }, [pendingPair, handleExchange]);

  function handleManualExchange(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setManualSubmitted(true);
    if (!manualEventId.trim() || !manualToken.trim()) return;
    void handleExchange(manualEventId.trim(), manualToken.trim());
  }

  function onQrDecode(result: unknown) {
    const text = asString(result);
    if (!text.includes("/companion/join#v1.")) return;
    const hashPart = text.split("#")[1];
    if (!hashPart) return;
    const parts = hashPart.split(".");
    if (parts.length !== 3) return;
    const [, ev, tok] = parts;
    void handleExchange(ev, tok);
  }

  function readStored(): StoredCompanion[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as StoredCompanion[]) : [];
    } catch {
      return [];
    }
  }

  function savePairing(mode: "kiosk" | "scanner") {
    if (!pairInfo) return;
    const list = readStored().filter((d) => d.eventId !== pairInfo.eventId);
    list.push({
      eventId: pairInfo.eventId,
      name: pairInfo.name,
      mode,
      token: pairInfo.token,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    navigate({ to: "/companion" });
  }

  function confirmMode() {
    if (!pairInfo || !selectedMode) return;
    const existing = readStored().find((d) => d.eventId === pairInfo.eventId);
    if (existing?.mode && existing.mode !== selectedMode) {
      setSwitchFrom(existing.mode);
      return;
    }
    savePairing(selectedMode);
  }

  return (
    <Box sx={{ minHeight: "100dvh" }}>
      <AppBar position="static" color="inherit" elevation={0}>
        <Toolbar>
          <IconButton
            edge="start"
            aria-label="back to devices"
            onClick={() => navigate({ to: "/companion" })}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 2 }}>
            Pair device
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Box sx={{ mb: 3 }}>
          <ResponsiveStepper steps={STEPS} activeStep={activeStep} />
        </Box>

        {activeStep === 0 && (
          <Stack spacing={2}>
            <Card variant="outlined" sx={{ overflow: "hidden" }}>
              <Box sx={{ aspectRatio: "1 / 1", bgcolor: "#000" }}>
                <QrScanner
                  onScan={onQrDecode}
                  onError={() => {}}
                  sound={false}
                  components={{
                    finder: false,
                    torch: false,
                    onOff: false,
                    zoom: false,
                  }}
                  styles={{
                    container: {
                      width: "100%",
                      height: "100%",
                      aspectRatio: "auto",
                    },
                    video: {
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    },
                  }}
                />
              </Box>
            </Card>
            <Typography
              variant="body1"
              color="textSecondary"
              sx={{ textAlign: "center" }}
            >
              Scan the QR code shown on the "Pair companion device" screen.
            </Typography>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            <Divider>Or</Divider>
            <Typography
              variant="body1"
              color="textSecondary"
              sx={{ textAlign: "center" }}
            >
              Enter manually
            </Typography>
            <Box component="form" onSubmit={handleManualExchange} noValidate>
              <Stack spacing={2}>
                <TextField
                  label="Event ID"
                  value={manualEventId}
                  onChange={(e) => setManualEventId(e.target.value)}
                  required
                  error={manualEventIdError}
                  helperText={
                    manualEventIdError ? "Event ID is required" : undefined
                  }
                />
                <TextField
                  label="Pairing token"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  required
                  error={manualTokenError}
                  helperText={
                    manualTokenError ? "Pairing token is required" : undefined
                  }
                />
                <Button type="submit" variant="contained">
                  Exchange pairing token
                </Button>
              </Stack>
            </Box>
          </Stack>
        )}

        {activeStep === 1 && pairInfo && (
          <Stack spacing={3}>
            <Typography>
              Paired with <strong>{pairInfo.name}</strong>. How will this device
              be used?
            </Typography>
            <Stack spacing={2}>
              {MODE_OPTIONS.map((m) => (
                <ModeOptionCard
                  key={m.value}
                  selected={selectedMode === m.value}
                  onClick={() => setSelectedMode(m.value)}
                  icon={m.icon}
                  label={m.label}
                  description={m.description}
                />
              ))}
            </Stack>
            <Stack
              direction="row"
              spacing={2}
              sx={{ justifyContent: "flex-end" }}
            >
              <Button onClick={() => setActiveStep(0)}>Back</Button>
              <Button
                variant="contained"
                disabled={!selectedMode}
                onClick={confirmMode}
              >
                Confirm
              </Button>
            </Stack>
          </Stack>
        )}
      </Container>

      <Dialog
        open={switchFrom !== null}
        onClose={() => setSwitchFrom(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Switch how this device is used?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pairInfo?.name} is already paired on this browser as a {switchFrom}
            . Switching to a {selectedMode} replaces that pairing. The old mode
            stops working on this device.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSwitchFrom(null)}>Cancel</Button>
          <Button
            onClick={() => {
              if (selectedMode) savePairing(selectedMode);
            }}
          >
            Switch
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
