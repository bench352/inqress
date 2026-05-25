import {type FormEvent, useState} from 'react'
import {Alert, Box, Button, Card, CardContent, TextField, Typography,} from '@mui/material'
import {useNavigate} from '@tanstack/react-router'
import {useAuth} from '../../providers/useAuth'
import {apiUrl} from '../../api'

export default function Login() {
    const {login} = useAuth()
    const navigate = useNavigate()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            const response = await fetch(`${apiUrl}/api/events`, {
                headers: {
                    Authorization: `Basic ${btoa(`${username}:${password}`)}`,
                },
            })

            if (response.ok) {
                login(username, password)
                await navigate({to: '/'})
            } else {
                setError('Invalid username or password')
            }
        } catch {
            setError('Unable to connect to the server')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#f5f5f5',
            }}
        >
            <Card sx={{width: 500, mx: 2}}>
                <CardContent sx={{p: 4}}>
                    <Typography variant="h3" component="h1" gutterBottom sx={{textAlign: 'center'}}>
                        InQRess
                    </Typography>
                    <Typography
                        variant="h6"
                        component="h2"
                        color="text.secondary"
                        sx={{mb: 3, textAlign: 'center'}}
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
                            sx={{mb: 2}}
                        />
                        <TextField
                            label="Password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            fullWidth
                            required
                            sx={{mb: 2}}
                        />
                        {error && (
                            <Alert severity="error" sx={{mb: 2}}>
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
    )
}
