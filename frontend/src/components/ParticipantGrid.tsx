import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Box,
  Divider,
  Grid,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type { ParticipantItem } from "../pages/eventDetail/useEventDetail";
import { ParticipantCard } from "../pages/eventDetail/components/ParticipantCard";

interface Props {
  participants: ParticipantItem[];
  title: string;
  onClick: (participantId: string) => void;
  id?: string;
}

// Vertical gutter between card rows — matches Grid `spacing={2}` (2 x 8px), so
// each measured band carries its own bottom gap and rows stay pixel-identical.
const BAND_GAP_PX = 16;
// Rough height of one band before it is measured: a card is ~122px (no footer)
// to ~163px (checked-in footer), plus name-wrap headroom, plus the row gap.
// measureElement refines every rendered row, so this only sizes offscreen rows.
const ROW_ESTIMATE_PX = 160;

export default function ParticipantGrid({
  participants,
  title,
  onClick,
  id,
}: Props) {
  const theme = useTheme();
  const cols = useMediaQuery(theme.breakpoints.up("sm")) ? 2 : 1;

  // EventDetail passes a fresh inline `onClick` every render; hold it in a ref
  // so the callback handed to each memoized card is referentially stable and
  // only the one card whose `participant` identity changed re-renders on SSE.
  const onClickRef = useRef(onClick);
  useEffect(() => {
    onClickRef.current = onClick;
  });
  const handleOpen = useCallback((participantId: string) => {
    onClickRef.current(participantId);
  }, []);

  // One band == one visual row of `cols` cards; chunking keeps the two-column
  // layout and gutters identical to the previous single Grid container.
  const bands = useMemo(() => {
    const out: ParticipantItem[][] = [];
    for (let i = 0; i < participants.length; i += cols) {
      out.push(participants.slice(i, i + cols));
    }
    return out;
  }, [participants, cols]);

  // A window virtualizer positions rows in document space, so it needs the
  // sizer's absolute Y offset (scrollMargin). Sibling grids above resize on
  // measureElement corrections and on every check-in, which shifts this grid;
  // observe <body> so any document-height change re-measures the offset.
  const sizerRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const hasRows = participants.length > 0;
  useLayoutEffect(() => {
    const el = sizerRef.current;
    if (!hasRows || !el) return;
    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      setScrollMargin((prev) => (Math.abs(prev - top) < 0.5 ? prev : top));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [hasRows]);

  const virtualizer = useWindowVirtualizer({
    count: bands.length,
    estimateSize: () => ROW_ESTIMATE_PX,
    overscan: 2,
    scrollMargin,
    // Key rows by their first participant so cached measurements follow content
    // when the list re-sorts or the column count changes, not just the index.
    getItemKey: (index) => bands[index]?.[0]?.id ?? index,
  });

  if (!hasRows) return null;

  return (
    <>
      <Divider id={id}>
        <Typography variant="h6" color="textSecondary">
          {title}
        </Typography>
      </Divider>

      <Box
        ref={sizerRef}
        sx={{
          position: "relative",
          width: "100%",
          // Drop the trailing band gap so the section height matches the old
          // Grid container exactly (rows + gutters between them, none after).
          height: Math.max(virtualizer.getTotalSize() - BAND_GAP_PX, 0),
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <Box
            key={virtualRow.key}
            ref={virtualizer.measureElement}
            data-index={virtualRow.index}
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start - scrollMargin}px)`,
              paddingBottom: `${BAND_GAP_PX}px`,
            }}
          >
            <Grid container spacing={2}>
              {bands[virtualRow.index].map((a) => (
                <Grid key={a.id} size={{ xs: 12, sm: 6 }}>
                  <ParticipantCard participant={a} onOpen={handleOpen} />
                </Grid>
              ))}
            </Grid>
          </Box>
        ))}
      </Box>
    </>
  );
}
