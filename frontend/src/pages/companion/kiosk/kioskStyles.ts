import { useMemo } from "react";
import { buttonClasses, createTheme, useTheme } from "@mui/material";
import { grey } from "@mui/material/colors";
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
    fontSize: "2rem",
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

const KIOSK_EDGE = "#000000";

// Marks a contained button whose fill is the event accent, so the theme can pin
// that fill on hover. An sx rule shares its generated class with MUI's own hover
// rule, and MUI's is inserted last, so the pin has to outrank both.
export const kioskAccentClass = "KioskAccent";

// Pill shape. The accent never draws the boundary: a 2px black edge does, so a
// pale or white accent still reads as a button. The hard shadow sits under the
// button (no offset sideways) so a row of keys stays aligned.
const KIOSK_RADIUS = "9999px";
const KIOSK_SHADOW = `0 3px 0 0 ${KIOSK_EDGE}`;

// One shadow and one shape for every variant, so filled and outlined controls
// read as the same family. This is the kiosk theme's MuiButton override.
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

/** The app theme plus the booth's type roles and button shape. Guest kiosk and preview both use it. */
export function useKioskTheme() {
  const parent = useTheme();
  return useMemo(() => {
    const kiosk = createTheme(parent, {
      typography: KIOSK_TYPOGRAPHY,
      components: {
        MuiButton: {
          styleOverrides: { root: KIOSK_BUTTON_BASE },
          variants: [
            {
              props: { variant: "outlined" },
              // Outlined buttons carry no accent: ink label on the ink edge.
              // The outlined variant paints its label from this variable (a plain
              // `color` loses to the variant rule), so set the variable itself.
              // The callback receives the base theme, so read the palette off
              // the extended one.
              style: () => ({
                "--variant-outlinedColor": kiosk.palette.text.primary,
                // MUI's hover rule tints the background and solidifies the
                // border; pin both to their resting values. Scoped to the
                // outlined class so it never touches contained buttons.
                [`&.${buttonClasses.outlined}`]: {
                  "@media (hover: hover)": {
                    "&:hover": {
                      "--variant-outlinedBg": "transparent",
                      "--variant-outlinedBorder": kiosk.alpha(
                        kiosk.palette.text.primary,
                        0.5,
                      ),
                    },
                  },
                },
              }),
            },
            // Palette-colored contained buttons darken on hover; pin the fill
            // back to the color they rest at.
            ...(["success", "error"] as const).map((color) => ({
              props: { variant: "contained" as const, color },
              style: () => ({
                [`&.${buttonClasses.contained}`]: {
                  "@media (hover: hover)": {
                    "&:hover": {
                      "--variant-containedBg": kiosk.palette[color].main,
                    },
                  },
                },
              }),
            })),
            {
              props: { variant: "contained" as const },
              style: () => ({
                [`&.${kioskAccentClass}`]: {
                  "@media (hover: hover)": {
                    "&:hover": {
                      "--variant-containedBg": "var(--kiosk-accent)",
                      "--variant-containedColor": "var(--kiosk-accent-ink)",
                    },
                  },
                },
              }),
            },
          ],
        },
        MuiInput: {
          styleOverrides: {
            root: {
              // The bar is on for good: the booth sets user-select: none, and
              // Chrome already paints ::after under it. The doubled class
              // outranks MUI's palette color variant, which would paint primary.
              "&&::after": {
                borderBottom: `2px solid ${KIOSK_EDGE}`,
                transform: "scaleX(1) translateX(0)",
                transition: "none",
              },
              "&&.Mui-focused::after": {
                borderBottom: `2px solid ${KIOSK_EDGE}`,
                transform: "scaleX(1) translateX(0)",
              },
              // Pin MUI's hover thickening back to the resting line.
              "@media (hover: hover)": {
                "&:hover:not(.Mui-disabled, .Mui-error)::before": {
                  borderBottom: "1px solid rgba(0, 0, 0, 0.42)",
                },
              },
            },
          },
        },
        // Outlined only: Paper is also the dialog surface and the country menu.
        MuiCard: {
          styleOverrides: {
            root: {
              // Doubled class: Paper's outlined border is a 2-class rule too,
              // and only specificity settles which one wins.
              "&&.MuiPaper-outlined": {
                border: `2px solid ${KIOSK_EDGE}`,
                boxShadow: KIOSK_SHADOW,
                transition: "none",
              },
            },
          },
        },
      },
    });
    return kiosk;
  }, [parent]);
}

function luminance(hex: string): number | null {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
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

// The grey.100 panel behind the phone icon in KioskPhoneDialog: the darkest
// surface an accent mark sits on, so clearing 3:1 here clears it everywhere.
// grey[100] is imported rather than read off the theme: the app theme runs in
// cssVariables mode, where theme.palette.grey[100] is a var() string, unusable
// as hex here.
export const KIOSK_MARKS_SURFACE = grey[100];

/** True when the accent clears 3:1 contrast against the surface. */
export function accentReadable(hex: string, surface = "#ffffff"): boolean {
  const accent = luminance(hex);
  const behind = luminance(surface);
  if (accent === null || behind === null) return false;
  return (
    (Math.max(accent, behind) + 0.05) / (Math.min(accent, behind) + 0.05) >= 3
  );
}

// Accent when it clears 3:1 on the given surface, else the black edge, so a pale
// accent cannot disappear.
export function accentOnSurface(hex: string, surface = "#ffffff"): string {
  return accentReadable(hex, surface) ? hex : KIOSK_EDGE;
}

export function kioskContainedSx(accent: string): SxProps<Theme> {
  const color = getOnColor(accent);
  // The contained Button paints from these variables, and its own disabled
  // rule outranks them, so greying out needs no disabled style of ours.
  // The hover pin lives in the theme, not here: an sx rule and MUI's own
  // hover rule share one generated class, so source order lets the hover win.
  return {
    "--kiosk-accent": accent,
    "--kiosk-accent-ink": color,
    "--variant-containedBg": accent,
    "--variant-containedColor": color,
  };
}

/**
 * Standard-variant input: the placeholder uses the instruction face so it
 * matches the heading above the field. The underline itself is the kiosk
 * theme's MuiInput override; an sx rule here would outrank it.
 */
export function kioskInputSx(): SxProps<Theme> {
  return {
    "& .MuiInputBase-input::placeholder": {
      fontFamily: CONDENSED,
      opacity: 0.3,
    },
  };
}
