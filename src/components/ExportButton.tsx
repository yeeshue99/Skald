import { Download } from "lucide-react";
import { buttonClasses } from "./ui";

// A plain download link (no client JS): the browser saves the JSON because the
// route sets Content-Disposition: attachment. Styled as a secondary button.
export function ExportButton({ slug }: { slug: string }) {
  return (
    <a
      href={`/c/${slug}/settings/export`}
      download
      className={buttonClasses("secondary", "md", "w-fit")}
    >
      <Download className="size-4" /> Export JSON
    </a>
  );
}
