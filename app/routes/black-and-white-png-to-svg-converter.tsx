import type { Route } from "./+types/black-and-white-png-to-svg-converter";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "Black and White PNG to SVG Converter - Redirect | iLoveSVG";
  const description = "Black and White PNG to SVG Converter is consolidated into the most relevant iLoveSVG tool to avoid duplicate pages.";
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: "https://www.ilovesvg.com/black-and-white-image-to-svg-converter" },
  ];
}

export function loader() {
  return redirect("/black-and-white-image-to-svg-converter", 301);
}

export default function RedirectedRoute() {
  return null;
}
