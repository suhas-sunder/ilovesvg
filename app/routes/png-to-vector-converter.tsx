import type { Route } from "./+types/png-to-vector-converter";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "PNG to Vector Converter - Redirect | iLoveSVG";
  const description =
    "PNG to Vector Converter is consolidated into the PNG to SVG Converter to avoid duplicate pages.";
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: "https://www.ilovesvg.com/png-to-svg-converter" },
  ];
}

export function loader() {
  return redirect("/png-to-svg-converter", 301);
}

export default function RedirectedRoute() {
  return null;
}
