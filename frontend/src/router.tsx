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
import CompanionDevices from "./pages/companion/CompanionDevices";
import CompanionJoin from "./pages/companion/CompanionJoin";
import CompanionKiosk from "./pages/companion/CompanionKiosk";
import CompanionScanner from "./pages/companion/CompanionScanner";
import Settings from "./pages/settings/Settings";
import AddParticipantsManually from "./pages/addParticipantsManually/AddParticipantsManually";
import AddParticipantsBySpreadsheet from "./pages/addParticipantsSpreadsheet/AddParticipantsBySpreadsheet";
import BulkTicketDelivery from "./pages/bulkTicketDelivery/BulkTicketDelivery";
import CustomizeBooth from "./pages/customizeBooth/CustomizeBooth";
import DataSources from "./pages/dataSources/DataSources";
import DataSourceEditor from "./pages/dataSources/DataSourceEditor";

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
  path: "/",
  component: Login,
});

const loginAliasRoute = createRoute({
  getParentRoute: () => fullPageLayout,
  path: "/login",
  component: Login,
});

// Companion routes (full page, no admin shell)
const companionListRoute = createRoute({
  getParentRoute: () => fullPageLayout,
  path: "/companion",
  component: CompanionDevices,
});

const companionJoinRoute = createRoute({
  getParentRoute: () => fullPageLayout,
  path: "/companion/join",
  component: CompanionJoin,
});

const companionKioskRoute = createRoute({
  getParentRoute: () => fullPageLayout,
  path: "/companion/events/$eventId/kiosk",
  component: CompanionKiosk,
});

const companionScannerRoute = createRoute({
  getParentRoute: () => fullPageLayout,
  path: "/companion/events/$eventId/scanner",
  component: CompanionScanner,
});

// Admin shell now lives under /admin
// We keep the layout component but change the path prefix in child routes
const indexRoute = createRoute({
  getParentRoute: () => appShellLayout,
  path: "/admin",
  component: EventsList,
});

const eventsRoute = createRoute({
  getParentRoute: () => appShellLayout,
  path: "/admin/events",
  component: EventsList,
});

const eventDetailRoute = createRoute({
  getParentRoute: () => appShellLayout,
  path: "/admin/events/$eventId",
  component: EventDetail,
});

const addParticipantsManuallyRoute = createRoute({
  getParentRoute: () => eventDetailRoute,
  path: "/addParticipantsManually",
  component: AddParticipantsManually,
  staticData: { childPage: true },
});

const addParticipantsSpreadsheetRoute = createRoute({
  getParentRoute: () => eventDetailRoute,
  path: "/addParticipantsBySpreadsheet",
  component: AddParticipantsBySpreadsheet,
  staticData: { childPage: true },
});

const dataSourcesRoute = createRoute({
  getParentRoute: () => eventDetailRoute,
  path: "/dataSources",
  component: DataSources,
  staticData: { childPage: true },
  // Set by the sync error toast to open that source's error dialog directly.
  validateSearch: (
    search: Record<string, unknown>,
  ): { syncErrors?: string } => ({
    syncErrors:
      typeof search.syncErrors === "string" ? search.syncErrors : undefined,
  }),
});

const dataSourceNewRoute = createRoute({
  getParentRoute: () => eventDetailRoute,
  path: "/dataSources/new",
  component: DataSourceEditor,
  staticData: { childPage: true },
});

const dataSourceEditRoute = createRoute({
  getParentRoute: () => eventDetailRoute,
  path: "/dataSources/$sourceId",
  component: DataSourceEditor,
  staticData: { childPage: true },
});

const bulkTicketDeliveryRoute = createRoute({
  getParentRoute: () => appShellLayout,
  path: "/admin/events/$eventId/bulkTicketDelivery",
  component: BulkTicketDelivery,
  staticData: { fullWidth: true },
});

const customizeKioskRoute = createRoute({
  getParentRoute: () => appShellLayout,
  path: "/admin/events/$eventId/customizeKiosk",
  component: CustomizeBooth, // reuse file for now, will rename later
  staticData: { fullWidth: true },
});

const settingsRoute = createRoute({
  getParentRoute: () => appShellLayout,
  path: "/admin/settings",
  component: Settings,
});

const routeTree = rootRoute.addChildren([
  fullPageLayout.addChildren([
    loginRoute,
    loginAliasRoute,
    companionListRoute,
    companionJoinRoute,
    companionKioskRoute,
    companionScannerRoute,
  ]),
  appShellLayout.addChildren([
    indexRoute,
    eventsRoute,
    bulkTicketDeliveryRoute,
    customizeKioskRoute,
    eventDetailRoute.addChildren([
      addParticipantsSpreadsheetRoute,
      addParticipantsManuallyRoute,
      dataSourcesRoute,
      dataSourceNewRoute,
      dataSourceEditRoute,
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
    /** Renders instead of the event detail view, as a child of the event route. */
    childPage?: boolean;
  }
}
