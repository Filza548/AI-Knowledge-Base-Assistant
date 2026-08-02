/**
 * Renders an executable inline <script> on the server (runs synchronously during
 * HTML parsing, before hydration) but as an inert text/plain tag on the client, so
 * React's dev-mode "script tag" warning doesn't fire. suppressHydrationWarning
 * covers the resulting type="text/javascript" -> type="text/plain" mismatch.
 * See: https://nextjs.org/docs/app/guides/preventing-flash-before-hydration
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
