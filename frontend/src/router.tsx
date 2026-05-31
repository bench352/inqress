import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import FullPage from "./layouts/FullPage";
import AppShell from "./layouts/AppShell";
import Login from "./pages/login/Login";
import EventsList from "./pages/eventsList/EventsList";
import EventDetail from "./pages/eventDetail/EventDetail";
import CheckInBooth from "./pages/checkInBooth/CheckInBooth";
import Settings from "./pages/settings/Settings";
import AddAttendeesManually from "./pages/addAttendeesManually/AddAttendeesManually";
import AddAttendeesBySpreadsheet from "./pages/addAttendeesSpreadsheet/AddAttendeesBySpreadsheet";
import BulkTicketDelivery from "./pages/bulkTicketDelivery/BulkTicketDelivery";

const rootRoute = createRootRoute();

const fullPageLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: "full-page",
  component: FullPage,
});

const appShellLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: "app-shell",
  component: AppShell,
});

const loginRoute = createRoute({
  getParentRoute: () => fullPageLayout,
  path: "/login",
  component: Login,
});

const checkInBoothRoute = createRoute({
  getParentRoute: () => fullPageLayout,
  path: "/events/$eventId/checkInBooth",
  component: CheckInBooth,
});

const indexRoute = createRoute({
  getParentRoute: () => appShellLayout,
  path: "/",
  component: EventsList,
});

const eventsRoute = createRoute({
  getParentRoute: () => appShellLayout,
  path: "/events",
  component: EventsList,
});

const eventDetailRoute = createRoute({
  getParentRoute: () => appShellLayout,
  path: "/events/$eventId",
  component: EventDetail,
});

const addAttendeesManuallyRoute = createRoute({
  getParentRoute: () => eventDetailRoute,
  path: "/addAttendeesManually",
  component: AddAttendeesManually,
});

const addAttendeesSpreadsheetRoute = createRoute({
  getParentRoute: () => eventDetailRoute,
  path: "/addAttendeesBySpreadsheet",
  component: AddAttendeesBySpreadsheet,
});

const bulkTicketDeliveryRoute = createRoute({
  getParentRoute: () => appShellLayout,
  path: "/events/$eventId/bulkTicketDelivery",
  component: BulkTicketDelivery,
  staticData: { fullWidth: true },
});

const settingsRoute = createRoute({
  getParentRoute: () => appShellLayout,
  path: "/settings",
  component: Settings,
});

const routeTree = rootRoute.addChildren([
  fullPageLayout.addChildren([loginRoute, checkInBoothRoute]),
  appShellLayout.addChildren([
    indexRoute,
    eventsRoute,
    bulkTicketDeliveryRoute,
    eventDetailRoute.addChildren([
      addAttendeesSpreadsheetRoute,
      addAttendeesManuallyRoute,
    ]),
    settingsRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
  interface StaticDataRouteOption {
    fullWidth?: boolean;
  }
}
