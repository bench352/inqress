import {createRootRoute, createRoute, createRouter} from '@tanstack/react-router'
import FullPage from './layouts/FullPage'
import AppShell from './layouts/AppShell'
import Login from './pages/login/Login'
import EventsList from './pages/eventsList/EventsList'
import EventDetail from './pages/eventDetail/EventDetail'
import Scanner from './pages/scanner/Scanner'
import Settings from './pages/settings/Settings'
import AddAttendeesManually from './pages/addAttendeesManually/AddAttendeesManually'
import AddAttendeesBySpreadsheet from './pages/addAttendeesSpreadsheet/AddAttendeesBySpreadsheet'
import BulkTicketDelivery from './pages/bulkTicketDelivery/BulkTicketDelivery'

const rootRoute = createRootRoute()

const fullPageLayout = createRoute({
    getParentRoute: () => rootRoute,
    id: 'full-page',
    component: FullPage,
})

const appShellLayout = createRoute({
    getParentRoute: () => rootRoute,
    id: 'app-shell',
    component: AppShell,
})

const loginRoute = createRoute({
    getParentRoute: () => fullPageLayout,
    path: '/login',
    component: Login,
})

const scannerRoute = createRoute({
    getParentRoute: () => fullPageLayout,
    path: '/events/$eventId/scanner',
    component: Scanner,
})

const indexRoute = createRoute({
    getParentRoute: () => appShellLayout,
    path: '/',
    component: EventsList,
})

const eventsRoute = createRoute({
    getParentRoute: () => appShellLayout,
    path: '/events',
    component: EventsList,
})

const eventDetailRoute = createRoute({
    getParentRoute: () => appShellLayout,
    path: '/events/$eventId',
    component: EventDetail,
})

const addAttendeesManuallyRoute = createRoute({
    getParentRoute: () => appShellLayout,
    path: '/events/$eventId/addAttendeesManually',
    component: AddAttendeesManually,
})

const addAttendeesSpreadsheetRoute = createRoute({
    getParentRoute: () => appShellLayout,
    path: '/events/$eventId/addAttendeesBySpreadsheet',
    component: AddAttendeesBySpreadsheet,
})

const bulkTicketDeliveryRoute = createRoute({
    getParentRoute: () => appShellLayout,
    path: '/events/$eventId/bulkTicketDelivery',
    component: BulkTicketDelivery,
})

const settingsRoute = createRoute({
    getParentRoute: () => appShellLayout,
    path: '/settings',
    component: Settings,
})

const routeTree = rootRoute.addChildren([
    fullPageLayout.addChildren([loginRoute, scannerRoute]),
    appShellLayout.addChildren([
        indexRoute,
        eventsRoute,
        addAttendeesManuallyRoute,
        addAttendeesSpreadsheetRoute,
        bulkTicketDeliveryRoute,
        eventDetailRoute,
        settingsRoute,
    ]),
])

export const router = createRouter({routeTree})

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}
