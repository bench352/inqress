import { useEffect, useRef, useId } from "react";
import mermaid from "mermaid";

let mermaidInitialized = false;

interface Props {
  chart: string;
}

export default function MermaidDiagram({ chart }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId().replace(/:/g, "_");

  useEffect(() => {
    if (!mermaidInitialized) {
      mermaid.initialize({ startOnLoad: false, theme: "default" });
      mermaidInitialized = true;
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    const render = async () => {
      try {
        const { svg } = await mermaid.render(uniqueId, chart);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch {
        // mermaid render errors are non-critical
      }
    };
    void render();
    return () => {
      cancelled = true;
    };
  }, [chart, uniqueId]);

  return <div ref={containerRef} />;
}
