"use client";

import { renderMermaidSVG, THEMES } from "beautiful-mermaid";
import { useEffect, useId, useState } from "react";

interface MarkdownMermaidProps {
  readonly className?: string;
  readonly content: string;
  readonly height?: string;
  readonly theme?: string;
  readonly "theme-dark"?: string;
  readonly themeDark?: string;
  readonly width?: string;
}

function themeFor(name: string | undefined, fallback: "tokyo-night-light" | "tokyo-night") {
  return THEMES[typeof name === "string" && Object.hasOwn(THEMES, name) ? name : fallback]!;
}

function isolateSvg(svg: string, prefix: string) {
  const ids = new Map<string, string>();
  const withoutStyles = svg.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, "");
  if (/<style\b/i.test(withoutStyles))
    throw new Error("Mermaid output contains an unsupported style block");
  const withIsolatedIds = withoutStyles.replace(/\sid="([^"]+)"/g, (_, id: string) => {
    const isolated = `${prefix}-${id}`;
    ids.set(id, isolated);
    return ` id="${isolated}"`;
  });
  return withIsolatedIds.replace(
    /(marker-(?:start|end)="?)url\(#([^)]+)\)/g,
    (_, attribute: string, id: string) =>
      ids.has(id) ? `${attribute}url(#${ids.get(id)})` : `${attribute}url(#${id})`,
  );
}

/**
 * Renders Comark Mermaid source after hydration with only known built-in theme names.
 *
 * `beautiful-mermaid` embeds unscoped CSS and a remote font import in its style block. The block is
 * removed before insertion and this package supplies scoped document styles instead. Invalid source
 * clears any prior diagram and is rendered as escaped text rather than injected HTML.
 */
export function MarkdownMermaid({
  className = "",
  content,
  height = "auto",
  theme,
  "theme-dark": themeDarkAttribute,
  themeDark,
  width = "100%",
}: MarkdownMermaidProps) {
  const instanceId = useId().replaceAll(":", "-");
  const [svg, setSvg] = useState<string>();
  const [error, setError] = useState<string>();
  const [isDark, setIsDark] = useState(false);

  // oxlint-disable react(set-state-in-effect)
  useEffect(() => {
    const html = document.documentElement;
    const update = () => setIsDark(html.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // oxlint-disable react(set-state-in-effect)
  useEffect(() => {
    try {
      setSvg(
        isolateSvg(
          renderMermaidSVG(
            content,
            themeFor(
              isDark ? (themeDark ?? themeDarkAttribute) : theme,
              isDark ? "tokyo-night" : "tokyo-night-light",
            ),
          ),
          instanceId,
        ),
      );
      setError(undefined);
    } catch (cause) {
      setSvg(undefined);
      setError(cause instanceof Error ? cause.message : "Failed to render diagram");
    }
  }, [content, instanceId, isDark, theme, themeDark, themeDarkAttribute]);

  return (
    <div
      className={`mermaid ${className}`}
      data-error={error}
      style={{ display: "flex", justifyContent: "center", width, height }}
    >
      {svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : null}
      {error ? <pre>{content}</pre> : null}
    </div>
  );
}
