import type { PropsWithChildren } from "react";
import BootScreen from "./BootScreen";
import { useBootHold, useBootState } from "./bootHold";

/**
 * The only mount point of the boot screen. It sits above the session check and
 * the router so a route change can hand the screen to the next wait instead of
 * replacing it.
 */
export default function BootHost({ children }: PropsWithChildren) {
  const { active, message } = useBootState();
  return (
    <>
      {children}
      <BootScreen open={active} message={message} />
    </>
  );
}

// A route chunk has no message of its own; it holds the same boot screen the
// shell and the page info use, so the fade is not replayed between them.
export function RoutePending() {
  useBootHold(true);
  return null;
}
