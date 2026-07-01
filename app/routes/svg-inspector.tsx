import type { Route } from "./+types/svg-inspector";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "SVG Inspector - Redirect | iLoveSVG";
  const description =
    "SVG Inspector is consolidated into the SVG Preview Viewer to avoid duplicate pages.";
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: "https://www.ilovesvg.com/svg-preview-viewer" },
  ];
}

export function loader() {
  return redirect("/svg-preview-viewer", 301);
}

export default function RedirectedRoute() {
  return null;
}
