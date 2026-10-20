import { createContext, useContext } from "react";

export interface DataSourceSyncState {
  sourceId: string;
  sourceName: string;
}

// null means nothing is syncing; undefined means there is no provider.
export const DataSourceSyncContext = createContext<
  DataSourceSyncState | null | undefined
>(undefined);

export function useDataSourceSync(): DataSourceSyncState | null {
  const value = useContext(DataSourceSyncContext);
  if (value === undefined) {
    throw new Error(
      "useDataSourceSync must be used within a DataSourceSyncProvider",
    );
  }
  return value;
}
