import { type FormEvent, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
} from "@mui/material";
import { brandFontFamily } from "@/brandFont.ts";
import { isSafeRedirectPath } from "@/providers/redirectToLogin.ts";
import { useAuth } from "@/providers/useAuth.ts";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(username, password);
      // Read redirect param if present
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect");
      const safeRedirect =
        redirect && isSafeRedirectPath(redirect) ? redirect : "/";
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
              sx={{ mb: 2 }}
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
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
              disabled={!username || !password}
            >
              Login
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
