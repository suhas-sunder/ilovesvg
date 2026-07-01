import type { Route } from "./+types/svg-resizer";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "SVG Resizer - Redirect | iLoveSVG";
  const description =
    "SVG Resizer is consolidated into the SVG Resize and Scale Editor to avoid duplicate pages.";
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: "https://www.ilovesvg.com/svg-resize-and-scale-editor" },
  ];
}

export function loader() {
  return redirect("/svg-resize-and-scale-editor", 301);
}

export default function RedirectedRoute() {
  return null;
}
