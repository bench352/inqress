import { type FormEvent, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  TextField,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { brandFontFamily } from "@/brandFont.ts";
import { isSafeRedirectPath } from "@/providers/redirectToLogin.ts";
import { useAuth } from "@/providers/useAuth.ts";
import PhonelinkIcon from "@mui/icons-material/Phonelink";
export default function Login() {
  const { login, isAuthenticated, logout } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const usernameError = submitted && !username.trim();
  const passwordError = submitted && !password;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    if (loading || !username.trim() || !password) return;
    setLoading(true);

    try {
      await login(username, password);
      // Read redirect param if present
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect");
      const safeRedirect =
        redirect && isSafeRedirectPath(redirect) ? redirect : "/admin";
      window.location.assign(safeRedirect);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (
        message.startsWith("Too many login attempts") ||
        message.startsWith("Session cookie was not stored")
      ) {
        setError(message);
      } else {
        setError("Invalid username or password");
      }
    } finally {
      setLoading(false);
    }
  };

  // Shared footer so the root page and the login page read the same way.
  const companionSection = (
    <>
      <Divider sx={{ my: 3 }}>or</Divider>
      <Button
        variant="outlined"
        size="large"
        fullWidth
        onClick={() => (window.location.href = "/companion")}
        startIcon={<PhonelinkIcon />}
      >
        Use as Companion device
      </Button>
    </>
  );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#f5f5f5",
      }}
    >
      <Card sx={{ width: 500, mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography
            variant="h1"
            gutterBottom
            sx={{
              fontFamily: brandFontFamily,
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            InQRess
          </Typography>
          {isAuthenticated ? (
            <>
              <Typography
                variant="h6"
                component="h2"
                sx={{ mb: 3, textAlign: "center" }}
              >
                Signed in as administrator
              </Typography>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={() => window.location.assign("/admin")}
              >
                Login as admin
              </Button>
              <Button
                variant="text"
                size="small"
                fullWidth
                sx={{ mt: 1 }}
                onClick={() => {
                  void logout().then((ok) => {
                    if (!ok)
                      enqueueSnackbar("Cannot sign out. Please try again.", {
                        variant: "error",
                      });
                  });
                }}
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Typography
                variant="h6"
                component="h2"
                sx={{ mb: 3, textAlign: "center" }}
              >
                Login as administrator
              </Typography>
              <Box component="form" onSubmit={handleSubmit} noValidate>
                <TextField
                  label="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  fullWidth
                  autoFocus
                  required
                  error={usernameError}
                  helperText={
                    usernameError ? "Enter your username." : undefined
                  }
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  fullWidth
                  required
                  error={passwordError}
                  helperText={
                    passwordError ? "Enter your password." : undefined
                  }
                  sx={{ mb: 2 }}
                />
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  loading={loading}
                >
                  Login
                </Button>
              </Box>
            </>
          )}
          {companionSection}
        </CardContent>
      </Card>
    </Box>
  );
}
