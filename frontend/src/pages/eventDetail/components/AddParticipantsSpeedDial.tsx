import { SpeedDial, SpeedDialAction } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import TableChartIcon from "@mui/icons-material/TableChart";
import { useNavigate } from "@tanstack/react-router";

interface Props {
  eventId: string;
}

export default function AddParticipantsSpeedDial({ eventId }: Props) {
  const navigate = useNavigate();

  return (
    <SpeedDial
      ariaLabel="Add participants"
      icon={<AddIcon />}
      sx={{ position: "fixed", bottom: 24, right: 24 }}
      FabProps={{ color: "secondary" }}
    >
      <SpeedDialAction
        icon={<PersonAddIcon />}
        slotProps={{ tooltip: { title: "Add manually" } }}
        onClick={() =>
          navigate({
            to: "/events/$eventId/addParticipantsManually",
            params: { eventId },
          })
        }
      />
      <SpeedDialAction
        icon={<TableChartIcon />}
        slotProps={{ tooltip: { title: "By spreadsheet" } }}
        onClick={() =>
          navigate({
            to: "/events/$eventId/addParticipantsBySpreadsheet",
            params: { eventId },
          })
        }
      />
    </SpeedDial>
  );
}
