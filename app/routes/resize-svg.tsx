import type { Route } from "./+types/resize-svg";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "Resize SVG - Redirect | iLoveSVG";
  const description =
    "Resize SVG is consolidated into the SVG Resize and Scale Editor to avoid duplicate pages.";
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
