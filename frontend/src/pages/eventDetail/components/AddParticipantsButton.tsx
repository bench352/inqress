import { SpeedDial, SpeedDialAction } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DatasetLinkedIcon from "@mui/icons-material/DatasetLinked";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import TableChartIcon from "@mui/icons-material/TableChart";
import { useNavigate } from "@tanstack/react-router";

interface Props {
  eventId: string;
}

export default function AddParticipantsButton({ eventId }: Props) {
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
        slotProps={{
          tooltip: { open: true, title: "Add manually" },
          staticTooltipLabel: { sx: { whiteSpace: "nowrap" } },
        }}
        onClick={() =>
          navigate({
            to: "/admin/events/$eventId/addParticipantsManually",
            params: { eventId },
          })
        }
      />
      <SpeedDialAction
        icon={<TableChartIcon />}
        slotProps={{
          tooltip: { open: true, title: "Import spreadsheet" },
          staticTooltipLabel: { sx: { whiteSpace: "nowrap" } },
        }}
        onClick={() =>
          navigate({
            to: "/admin/events/$eventId/addParticipantsBySpreadsheet",
            params: { eventId },
          })
        }
      />
      <SpeedDialAction
        icon={<DatasetLinkedIcon />}
        slotProps={{
          tooltip: { open: true, title: "Add data source" },
          staticTooltipLabel: { sx: { whiteSpace: "nowrap" } },
        }}
        onClick={() =>
          navigate({
            to: "/admin/events/$eventId/dataSources/new",
            params: { eventId },
          })
        }
      />
    </SpeedDial>
  );
}
