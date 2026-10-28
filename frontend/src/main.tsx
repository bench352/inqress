import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createTheme, CssBaseline, ThemeProvider } from "@mui/material";
import { RouterProvider } from "@tanstack/react-router";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "./assets/fonts/Reglo/reglo.css";
import { SnackbarProvider } from "notistack";
import SessionAuthProvider from "./providers/SessionAuthProvider";
import SystemClockProvider from "./providers/SystemClockProvider";
import BootHost from "./components/boot";
import SnackbarAlert from "./components/SnackbarAlert";
import { router } from "./router";

const theme = createTheme({
  cssVariables: true,
  palette: {
    primary: {
      main: "#01579b",
    },
    secondary: {
      main: "#fdd835",
    },
  },
  components: {
    MuiTextField: { defaultProps: { variant: "outlined" } },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider
        maxSnack={6}
        autoHideDuration={10000}
        Components={{
          default: SnackbarAlert,
          success: SnackbarAlert,
          error: SnackbarAlert,
          warning: SnackbarAlert,
          info: SnackbarAlert,
        }}
      >
        <BootHost>
          <SessionAuthProvider>
            <SystemClockProvider>
              <RouterProvider router={router} />
            </SystemClockProvider>
          </SessionAuthProvider>
        </BootHost>
      </SnackbarProvider>
    </ThemeProvider>
  </StrictMode>,
);
