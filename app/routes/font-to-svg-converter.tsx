import type { Route } from "./+types/font-to-svg-converter";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "Font to SVG Converter - Redirect | iLoveSVG";
  const description =
    "Font to SVG Converter is consolidated into the Text to SVG Converter to avoid duplicate pages.";
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
