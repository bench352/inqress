import Grid from '@mui/material/Grid'
import {Button, IconButton} from '@mui/material'
import BackspaceIcon from '@mui/icons-material/Backspace'

interface Props {
    onDigit: (digit: string) => void
    onBackspace: () => void
    disabled: boolean
}

const digits = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#'],
]

export default function PhoneDialPad({onDigit, onBackspace, disabled}: Props) {
    return (
        <Grid container spacing={1} sx={{maxWidth: 360}}>
            {digits.map((row, ri) =>
                row.map((digit) => (
                    <Grid key={ri * 3 + row.indexOf(digit)} size={4}>
                        <Button
                            fullWidth
                            variant="contained"
                            disabled={disabled}
                            onClick={() => onDigit(digit)}
                            sx={{minHeight: 56, fontSize: '1.5rem'}}
                        >
                            {digit}
                        </Button>
                    </Grid>
                ))
            )}
            <Grid size={4}>
                <Button
                    fullWidth
                    variant="contained"
                    disabled={disabled}
                    sx={{minHeight: 56}}
                    onClick={() => onDigit(',')}
                >
                    ,
                </Button>
            </Grid>
            <Grid size={4}>
                <Button
                    fullWidth
                    variant="contained"
                    disabled={disabled}
                    sx={{minHeight: 56}}
                    onClick={() => onDigit('+')}
                >
                    +
                </Button>
            </Grid>
            <Grid size={4}>
                <IconButton
                    onClick={onBackspace}
                    disabled={disabled}
                    sx={{minHeight: 56, width: '100%'}}
                >
                    <BackspaceIcon/>
                </IconButton>
            </Grid>
        </Grid>
    )
}
