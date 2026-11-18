import { useCallback } from "react";
import confetti from "canvas-confetti";

const COLORS = ["#29b6f6", "#00e676", "#ffeb3b", "#ff4081"];

// The default export renders through a blob: Worker, which our CSP blocks.
// useWorker is only read by create(), not by a fire() option.
const cannon = confetti.create(undefined, {
  useWorker: false,
  resize: true,
});

export function useConfetti() {
  const fire = useCallback(() => {
    cannon({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: COLORS,
      zIndex: 2000,
    });
    cannon({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: COLORS,
      zIndex: 2000,
    });
  }, []);

  return { fire };
}
