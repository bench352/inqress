import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {createTheme, CssBaseline, ThemeProvider} from '@mui/material'
import {RouterProvider} from '@tanstack/react-router'
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider'
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs'
import '@fontsource/roboto/300.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import QueryClientProvider from './providers/QueryClientProvider'
import BasicAuthProvider from './providers/BasicAuthProvider'
import {router} from './router'

const theme = createTheme({
    cssVariables: true,
})

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider theme={theme}>
            <CssBaseline/>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <QueryClientProvider>
                    <BasicAuthProvider>
                        <RouterProvider router={router}/>
                    </BasicAuthProvider>
                </QueryClientProvider>
            </LocalizationProvider>
        </ThemeProvider>
    </StrictMode>,
)
