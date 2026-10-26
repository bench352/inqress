import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DatasetLinkedIcon from "@mui/icons-material/DatasetLinked";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SyncIcon from "@mui/icons-material/Sync";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useSnackbar } from "notistack";
import { ApiError, useApi } from "@/api.ts";
import AppDialog from "@/components/AppDialog";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import { useDataSourceSync } from "@/providers/useDataSourceSync";
import { modeLabel, summaryParts, type DataSourceResponse } from "./types";

function summaryText(source: DataSourceResponse): string | null {
  const summary = source.lastSummary;
  if (!summary) return null;
  const parts = summaryParts(summary);
  return parts.length > 0
    ? `Last sync: ${parts.join(", ")}`
    : "Last sync: no changes";
}

function errorSamples(source: DataSourceResponse | null): string[] {
  return source?.lastSummary?.errorSamples ?? [];
}

export default function DataSources() {
  const { eventId } = useParams({
    from: "/app-shell/admin/events/$eventId/dataSources",
  });
  const { syncErrors } = useSearch({
    from: "/app-shell/admin/events/$eventId/dataSources",
  });
  const navigate = useNavigate();
  const api = useApi();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const syncing = useDataSourceSync();
  const [pendingDelete, setPendingDelete] = useState<DataSourceResponse | null>(
    null,
  );

  const eventQuery = useQuery<{ name: string }>({
    queryKey: ["event", eventId],
    queryFn: () => api.get(`/api/events/${eventId}`),
    enabled: !!eventId,
  });

  const sourcesQuery = useQuery<DataSourceResponse[]>({
    queryKey: ["dataSources", eventId],
    queryFn: () => api.get(`/api/events/${eventId}/dataSources`),
    enabled: !!eventId,
    // A background sync changes the source rows without telling this page.
    refetchInterval: 30000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["dataSources", eventId] });
    queryClient.invalidateQueries({ queryKey: ["participants", eventId] });
  };

  const syncMutation = useMutation({
    mutationFn: (sourceId: string) =>
      api.post(`/api/events/${eventId}/dataSources/${sourceId}/sync`),
    // The sync's own event refreshes the card and reports the result.
    onError: (err: unknown) => {
      enqueueSnackbar(
        err instanceof ApiError && typeof err.detail === "string"
          ? err.detail
          : "Could not start the sync.",
        { variant: "error" },
      );
    },
  });

  const activatedMutation = useMutation({
    mutationFn: ({ id, activated }: { id: string; activated: boolean }) =>
      api.put(`/api/events/${eventId}/dataSources/${id}/activated`, {
        activated,
      }),
    onSuccess: invalidate,
    onError: () =>
      enqueueSnackbar("Could not change automatic sync.", { variant: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (sourceId: string) =>
      api.del(`/api/events/${eventId}/dataSources/${sourceId}`),
    onSuccess: () => {
      setPendingDelete(null);
      invalidate();
      enqueueSnackbar("Data source deleted.", { variant: "success" });
    },
    onError: () =>
      enqueueSnackbar("Could not delete the data source.", {
        variant: "error",
      }),
  });

  const sources = sourcesQuery.data ?? [];
  const errorSource =
    sources.find(
      (source) => source.id === syncErrors && errorSamples(source).length > 0,
    ) ?? null;

  const showErrors = useCallback(
    (sourceId: string) =>
      void navigate({
        to: "/admin/events/$eventId/dataSources",
        params: { eventId },
        search: { syncErrors: sourceId },
      }),
    [navigate, eventId],
  );

  const hideErrors = useCallback(
    () =>
      void navigate({
        to: "/admin/events/$eventId/dataSources",
        params: { eventId },
        search: {},
        replace: true,
      }),
    [navigate, eventId],
  );

  // A param naming a source that is gone (or whose errors a later sync cleared)
  // must not stay in the URL.
  useEffect(() => {
    if (syncErrors && !sourcesQuery.isLoading && !errorSource) hideErrors();
  }, [syncErrors, errorSource, sourcesQuery.isLoading, hideErrors]);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Data sources"
        subtitle={eventQuery.data?.name}
        onBack={() =>
          navigate({
            to: "/admin/events/$eventId/settings",
            params: { eventId },
          })
        }
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() =>
              navigate({
                to: "/admin/events/$eventId/dataSources/new",
                params: { eventId },
              })
            }
            sx={{ width: { xs: "100%", sm: "auto" }, flexShrink: 0 }}
          >
            Add data source
          </Button>
        }
      />

      {!sourcesQuery.isLoading && sources.length === 0 && (
        <EmptyState icon={<DatasetLinkedIcon />}>
          No data sources yet. Add one to keep the guest list up to date from a
          spreadsheet.
        </EmptyState>
      )}

      {sources.map((source) => (
        <Card key={source.id} variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", flexWrap: "wrap" }}
            >
              <Typography variant="h6">{source.name}</Typography>
              <Chip size="small" label={modeLabel(source)} />
              {syncing?.sourceId === source.id && (
                <Chip
                  size="small"
                  color="info"
                  icon={<CircularProgress size={12} color="inherit" />}
                  label="Syncing…"
                />
              )}
              {!source.activated && (
                <Chip size="small" color="warning" label="Sync paused" />
              )}
            </Stack>

            <Typography variant="body1" color="textSecondary">
              {source.activateNew
                ? "New participants can check in"
                : "New participants wait to be admitted"}
              {" · "}
              {source.lastSuccessAt
                ? `Last synced ${dayjs(source.lastSuccessAt).format("YYYY-MM-DD HH:mm")}`
                : "Not synced yet"}
            </Typography>

            {summaryText(source) && (
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", flexWrap: "wrap" }}
              >
                <Typography variant="body1" color="textSecondary">
                  {summaryText(source)}
                </Typography>
                {errorSamples(source).length > 0 && (
                  <IconButton
                    size="small"
                    aria-label="Show sync errors"
                    onClick={() => showErrors(source.id)}
                  >
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>
            )}

            {source.lastError && (
              <Typography variant="body1" color="error">
                {source.lastError}
              </Typography>
            )}

            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", flexWrap: "wrap" }}
            >
              <Button
                variant="contained"
                startIcon={<SyncIcon />}
                disabled={syncMutation.isPending}
                onClick={() => syncMutation.mutate(source.id)}
              >
                Sync now
              </Button>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() =>
                  navigate({
                    to: "/admin/events/$eventId/dataSources/$sourceId",
                    params: { eventId, sourceId: source.id },
                  })
                }
              >
                Edit
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setPendingDelete(source)}
              >
                Delete
              </Button>
              <FormControlLabel
                sx={{ ml: 1 }}
                control={
                  <Switch
                    checked={source.activated}
                    disabled={activatedMutation.isPending}
                    onChange={(e) =>
                      activatedMutation.mutate({
                        id: source.id,
                        activated: e.target.checked,
                      })
                    }
                  />
                }
                label="Automatic sync"
              />
            </Stack>
          </Stack>
        </Card>
      ))}

      <AppDialog
        open={!!errorSource}
        onClose={hideErrors}
        title={`Sync errors in ${errorSource?.name}`}
      >
        <Stack spacing={0.5}>
          {errorSamples(errorSource).map((sample, index) => (
            <Typography key={index} variant="body1" color="error">
              {sample}
            </Typography>
          ))}
        </Stack>
      </AppDialog>

      <Dialog open={!!pendingDelete} onClose={() => setPendingDelete(null)}>
        <DialogTitle>Delete this data source?</DialogTitle>
        <DialogContent>
          <Typography>
            &ldquo;{pendingDelete?.name}&rdquo; stops syncing and its saved row
            links are removed. People and tickets already created stay.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button
            color="error"
            loading={deleteMutation.isPending}
            onClick={() =>
              pendingDelete && deleteMutation.mutate(pendingDelete.id)
            }
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
