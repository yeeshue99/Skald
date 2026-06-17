"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Renders themed preview content inside an isolated <iframe>, so the surrounding
// page's own [data-campaign] decorations cannot leak into the preview. The page
// wrapper and the preview wrapper are BOTH [data-campaign]; the decoration rules
// are descendant selectors keyed on [data-campaign][data-X="val"], and the
// value-keyed variants share identical selector text, so when both wrappers
// match they tie at equal specificity and CSS resolves it by stylesheet source
// order — letting the campaign theme override a draft decoration. An iframe is
// its own document with a single [data-campaign], removing the tie entirely.
// (Bonus: the fixed texture ::before is relative to the iframe viewport, so the
// backdrop previews contained instead of escaping to the page.)
//
// The app's stylesheets are cloned into the frame by ELEMENT (link/style nodes),
// never by reading `.cssRules` — that throws a SecurityError on cross-origin
// sheets (e.g. Google Fonts). Cloning the <link> re-applies the same CSS + fonts.
export function ThemePreviewFrame({
  dataAttrs,
  cssVars,
  title = "Theme preview",
  className,
  children,
}: {
  dataAttrs: Record<string, string>;
  cssVars: CSSProperties;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);

  // Set up the (srcless, same-origin) iframe once: clone the page's stylesheets
  // into it, then expose its <body> as the portal target and auto-size the frame
  // to its content. All DOM here is reached through the ref — the sanctioned
  // imperative escape hatch — and the effect has no reactive deps.
  useEffect(() => {
    const iframe = ref.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc) return;
    document
      .querySelectorAll('link[rel="stylesheet"], style')
      .forEach((node) => doc.head.appendChild(node.cloneNode(true)));
    doc.documentElement.style.height = "100%";
    doc.body.style.margin = "0";
    doc.body.style.height = "100%";
    const body = doc.body;
    const sync = () => {
      iframe.style.height = `${body.scrollHeight}px`;
    };
    const ro = new ResizeObserver(sync);
    ro.observe(body);
    setMount(body);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      <iframe ref={ref} title={title} className={className} />
      {mount
        ? createPortal(
            <div
              {...dataAttrs}
              style={{ ...cssVars, minHeight: "100%", background: "var(--bg)" }}
            >
              {children}
            </div>,
            mount,
          )
        : null}
    </>
  );
}
