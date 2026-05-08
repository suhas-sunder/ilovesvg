import type { Route } from "./+types/tif-to-svg-converter";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "TIF to SVG Converter - Redirect | iLoveSVG";
  const description = "TIF to SVG Converter is consolidated into the most relevant iLoveSVG tool to avoid duplicate pages.";
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: "https://www.ilovesvg.com/tiff-to-svg-converter" },
  ];
}

export function loader() {
  return redirect("/tiff-to-svg-converter", 301);
}

export default function RedirectedRoute() {
  return null;
}
