import type { Route } from "./+types/jpg-to-vector-converter";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "JPG to Vector Converter - Redirect | iLoveSVG";
  const description =
    "JPG to Vector Converter is consolidated into the JPG to SVG Converter to avoid duplicate pages.";
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: "https://www.ilovesvg.com/jpg-to-svg-converter" },
  ];
}

export function loader() {
  return redirect("/jpg-to-svg-converter", 301);
}

export default function RedirectedRoute() {
  return null;
}
