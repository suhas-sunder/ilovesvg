import type { Route } from "./+types/svg-viewbox-editor";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "SVG ViewBox Editor - Redirect | iLoveSVG";
  const description = "SVG ViewBox Editor is consolidated into the most relevant iLoveSVG tool to avoid duplicate pages.";
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
