import { useCallback } from "react";
import confetti from "canvas-confetti";

const COLORS = ["#29b6f6", "#00e676", "#ffeb3b", "#ff4081"];

export function useConfetti() {
  const fire = useCallback(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: COLORS,
      zIndex: 2000,
    });
    confetti({
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
