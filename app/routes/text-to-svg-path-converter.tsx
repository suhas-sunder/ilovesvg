import type { Route } from "./+types/text-to-svg-path-converter";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "Text to SVG Path Converter - Redirect | iLoveSVG";
  const description =
    "Text to SVG Path Converter is consolidated into the Text to SVG Converter to avoid duplicate pages.";
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: "https://www.ilovesvg.com/text-to-svg-converter" },
  ];
}

export function loader() {
  return redirect("/text-to-svg-converter", 301);
}

export default function RedirectedRoute() {
  return null;
}
