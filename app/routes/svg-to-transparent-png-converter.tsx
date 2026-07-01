import type { Route } from "./+types/svg-to-transparent-png-converter";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "SVG to Transparent PNG Converter - Redirect | iLoveSVG";
  const description =
    "SVG to Transparent PNG Converter is consolidated into the SVG to PNG Converter to avoid duplicate pages.";
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: "https://www.ilovesvg.com/svg-to-png-converter" },
  ];
}

export function loader() {
  return redirect("/svg-to-png-converter", 301);
}

export default function RedirectedRoute() {
  return null;
}
