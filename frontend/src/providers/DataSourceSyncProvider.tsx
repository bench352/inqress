import type { PropsWithChildren } from "react";
import { DataSourceSyncContext } from "./useDataSourceSync";
import type { DataSourceSyncState } from "./useDataSourceSync";

/** Shares the data source sync in flight with the event's child pages. */
export default function DataSourceSyncProvider({
  value,
  children,
}: PropsWithChildren<{ value: DataSourceSyncState | null }>) {
  return (
    <DataSourceSyncContext.Provider value={value}>
      {children}
    </DataSourceSyncContext.Provider>
  );
}
