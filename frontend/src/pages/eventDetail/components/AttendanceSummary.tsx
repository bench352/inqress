import {Box, LinearProgress, Paper, Stack, Typography} from '@mui/material'

interface Props {
    totalCount: number
    attendedCount: number
}

export default function AttendanceSummary({totalCount, attendedCount}: Props) {
    return (
        <Paper variant="outlined" sx={{p: 2}}>
            <Stack direction="row" spacing={2} sx={{alignItems: 'flex-end'}}>
                <Stack direction="column" spacing={0} sx={{flexGrow: 1}}>
                    <Typography variant="subtitle2" gutterBottom>
                        Attendance
                    </Typography>
                    <LinearProgress
                        variant="determinate"
                        value={totalCount > 0 ? (attendedCount / totalCount) * 100 : 0}
                    />
                </Stack>
                <Typography variant="h6" color="text.secondary" sx={{whiteSpace: 'nowrap'}}>
                    {attendedCount} / {totalCount}
                </Typography>
            </Stack>
            <Box sx={{flexGrow: 1}}/>
        </Paper>
    )
}
