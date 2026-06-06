import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createTheme, CssBaseline, ThemeProvider } from "@mui/material";
import { RouterProvider } from "@tanstack/react-router";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { SnackbarProvider } from "notistack";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import QueryClientProvider from "./providers/QueryClientProvider";
import BasicAuthProvider from "./providers/BasicAuthProvider";
import AppInfoProvider from "./providers/AppInfoProvider";
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
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={6} autoHideDuration={10000}>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <QueryClientProvider>
            <BasicAuthProvider>
              <AppInfoProvider>
                <RouterProvider router={router} />
              </AppInfoProvider>
            </BasicAuthProvider>
          </QueryClientProvider>
        </LocalizationProvider>
      </SnackbarProvider>
    </ThemeProvider>
  </StrictMode>,
);
