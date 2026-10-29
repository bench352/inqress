import { useMemo } from "react";
import { createTheme, useTheme } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import type { TypographyVariantsOptions } from "@mui/material/styles";

// Loaded by every chunk that renders a booth screen (guest kiosk and the
// admin Customize Booth preview), so the preview shows the real faces.
import "@fontsource/roboto-condensed/400.css";
import "@fontsource/roboto-condensed/700.css";

/**
 * Booth styling: the guest kiosk and the admin preview of it.
 *
 * Type roles are named theme variants: the theme owns face, weight, size and
 * line height, so call sites just pick a variant. No per-string font logic.
 */

export const CONDENSED = '"Roboto Condensed", "Roboto", sans-serif';
export const ROBOTO = '"Roboto", sans-serif';

declare module "@mui/material/styles" {
  interface TypographyVariants {
    kioskEventName: React.CSSProperties;
    kioskHeadline: React.CSSProperties;
    kioskResultHeading: React.CSSProperties;
    kioskResultTitle: React.CSSProperties;
    kioskBody: React.CSSProperties;
    kioskInstruction: React.CSSProperties;
    kioskSubtitle: React.CSSProperties;
    kioskSectionHeading: React.CSSProperties;
    kioskBanner: React.CSSProperties;
    kioskName: React.CSSProperties;
    kioskNameSmall: React.CSSProperties;
    kioskClock: React.CSSProperties;
    kioskHint: React.CSSProperties;
    kioskDetail: React.CSSProperties;
  }
  interface TypographyVariantsOptions {
    kioskEventName?: React.CSSProperties;
    kioskHeadline?: React.CSSProperties;
    kioskResultHeading?: React.CSSProperties;
    kioskResultTitle?: React.CSSProperties;
    kioskBody?: React.CSSProperties;
    kioskInstruction?: React.CSSProperties;
    kioskSubtitle?: React.CSSProperties;
    kioskSectionHeading?: React.CSSProperties;
    kioskBanner?: React.CSSProperties;
    kioskName?: React.CSSProperties;
    kioskNameSmall?: React.CSSProperties;
    kioskClock?: React.CSSProperties;
    kioskHint?: React.CSSProperties;
    kioskDetail?: React.CSSProperties;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    kioskEventName: true;
    kioskHeadline: true;
    kioskResultHeading: true;
    kioskResultTitle: true;
    kioskBody: true;
    kioskInstruction: true;
    kioskSubtitle: true;
    kioskSectionHeading: true;
    kioskBanner: true;
    kioskName: true;
    kioskNameSmall: true;
    kioskClock: true;
    kioskHint: true;
    kioskDetail: true;
  }
}

// Sizes are copied from the MUI variant each role replaces, so nothing resizes.
// Condensed carries the display roles; Roboto carries names and controls.
export const KIOSK_TYPOGRAPHY: TypographyVariantsOptions = {
  kioskEventName: {
    fontFamily: CONDENSED,
    fontWeight: 700,
    fontSize: "3.75rem",
    lineHeight: 1.1,
  },
  kioskHeadline: {
    fontFamily: CONDENSED,
    fontWeight: 700,
    fontSize: "3rem",
    lineHeight: 1.2,
  },
  kioskResultHeading: {
    fontFamily: CONDENSED,
    fontWeight: 700,
    fontSize: "3.75rem",
    lineHeight: 1.2,
  },
  kioskResultTitle: {
    fontFamily: CONDENSED,
    fontWeight: 400,
    fontSize: "3.75rem",
    lineHeight: 1.3,
  },
  kioskBody: {
    fontFamily: CONDENSED,
    fontWeight: 400,
    fontSize: "2.125rem",
    lineHeight: 1.3,
  },
  kioskInstruction: {
    fontFamily: CONDENSED,
    fontWeight: 400,
    fontSize: "3rem",
    lineHeight: 1.3,
  },
  kioskSubtitle: {
    fontFamily: CONDENSED,
    fontWeight: 400,
    fontSize: "1.5rem",
    lineHeight: 1.3,
  },
  kioskSectionHeading: {
    fontFamily: CONDENSED,
    fontWeight: 700,
    fontSize: "1.5rem",
    lineHeight: 1.2,
  },
  kioskBanner: {
    fontFamily: CONDENSED,
    fontWeight: 400,
    fontSize: "1rem",
    lineHeight: 1.5,
  },
  kioskName: {
    fontFamily: ROBOTO,
    fontWeight: 700,
    fontSize: "6rem",
    lineHeight: 1.1,
  },
  kioskNameSmall: {
    fontFamily: ROBOTO,
    fontWeight: 700,
    fontSize: "1.5rem",
    lineHeight: 1.1,
  },
  kioskClock: {
    fontFamily: CONDENSED,
    fontWeight: 700,
    fontSize: "35px",
    lineHeight: 1,
  },
  kioskHint: {
    fontFamily: CONDENSED,
    fontWeight: 400,
    fontSize: "1.25rem",
    lineHeight: 1.6,
  },
  kioskDetail: {
    fontFamily: ROBOTO,
    fontWeight: 500,
    fontSize: "1.25rem",
    lineHeight: 1.6,
  },
};

/** The app theme plus the booth's type roles. Guest kiosk and preview both use it. */
export function useKioskTheme() {
  const parent = useTheme();
  return useMemo(
    () => createTheme(parent, { typography: KIOSK_TYPOGRAPHY }),
    [parent],
  );
}

function luminance(hex: string): number | null {
  const h = hex.replace("#", "");
  if (h.length !== 6) return null;
  const lin = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const [r, g, b] = [0, 2, 4].map((i) =>
    lin(parseInt(h.slice(i, i + 2), 16) / 255),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Relative luminance per WCAG, returns black or white label for the given accent hex.
export function getOnColor(hex: string): string {
  const lum = luminance(hex);
  if (lum === null) return "#000000";
  return lum > 0.179 ? "#000000" : "#FFFFFF";
}

const KIOSK_EDGE = "#000000";

// The grey.100 panel behind the phone icon in KioskPhoneDialog: the darkest
// surface an accent mark sits on, so clearing 3:1 here clears it everywhere.
export const KIOSK_MARKS_SURFACE = "#f5f5f5";

// Accent when it clears 3:1 on the given surface, else the black edge, so a pale
// accent cannot disappear.
export function accentOnSurface(hex: string, surface = "#ffffff"): string {
  const accent = luminance(hex);
  const behind = luminance(surface);
  if (accent === null || behind === null) return KIOSK_EDGE;
  const ratio =
    (Math.max(accent, behind) + 0.05) / (Math.min(accent, behind) + 0.05);
  return ratio >= 3 ? hex : KIOSK_EDGE;
}

// Pill shape. The accent never draws the boundary: a 2px black edge does, so a
// pale or white accent still reads as a button. The hard shadow sits under the
// button (no offset sideways) so a row of keys stays aligned.
const KIOSK_RADIUS = "9999px";
const KIOSK_SHADOW = `0 3px 0 0 ${KIOSK_EDGE}`;

// One shadow and one shape for every variant, so filled and outlined controls
// read as the same family.
const KIOSK_BUTTON_BASE = {
  borderRadius: KIOSK_RADIUS,
  border: "2px solid",
  borderColor: KIOSK_EDGE,
  boxShadow: KIOSK_SHADOW,
  "&:hover": { boxShadow: KIOSK_SHADOW },
  "&:active": { boxShadow: KIOSK_SHADOW },
  "&.Mui-focusVisible": { boxShadow: KIOSK_SHADOW },
  "&.Mui-disabled": { boxShadow: "none" },
  // MUI animates background-color for up to ~250ms while loading, delaying the disabled grey.
  transition: "none",
  ["&.MuiButton-loading"]: { backgroundColor: "action.disabledBackground" },
  ["& .MuiButton-loadingIndicator"]: { color: "action.disabled" },
} as const;

export function kioskContainedSx(accent: string): SxProps<Theme> {
  const color = getOnColor(accent);
  // The contained Button paints from these variables, and its own disabled
  // rule outranks them, so greying out needs no disabled style of ours.
  return {
    ...KIOSK_BUTTON_BASE,
    "--variant-containedBg": accent,
    "--variant-containedColor": color,
    // A tap leaves :hover on the element, which would repaint the accent over
    // MUI's disabled grey; the :not() lets the disabled rule win.
    "&:hover:not(.Mui-disabled)": { bgcolor: accent, boxShadow: KIOSK_SHADOW },
  };
}

export function kioskOutlinedSx(): SxProps<Theme> {
  return {
    ...KIOSK_BUTTON_BASE,
    color: "text.primary",
  };
}

// Semantic confirms (green / red) keep their own palette colour; only shape,
// edge and shadow come from here.
export function kioskSemanticSx(): SxProps<Theme> {
  return KIOSK_BUTTON_BASE;
}

/**
 * Standard-variant input: paint the focus bar in the accent when it clears
 * 3:1 on the white dialog, otherwise black. The placeholder uses the
 * instruction face so it matches the heading above the field.
 * `.MuiInputBase-root::after` outranks MUI's own `&::after` rule.
 */
export function kioskInputSx(accent: string): SxProps<Theme> {
  const bar = accentOnSurface(accent);
  return {
    "& .MuiInputBase-root::after": {
      borderBottomColor: bar,
      transition: "none",
    },
    "& .MuiInputBase-input::placeholder": {
      fontFamily: CONDENSED,
      opacity: 0.3,
    },
  };
}
