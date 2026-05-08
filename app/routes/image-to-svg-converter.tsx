import type { Route } from "./+types/image-to-svg-converter";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "Image to SVG Converter - Redirect | iLoveSVG";
  const description = "Image to SVG Converter is consolidated into the most relevant iLoveSVG tool to avoid duplicate pages.";
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: "https://www.ilovesvg.com/" },
  ];
}

export function loader() {
  return redirect("/", 301);
}

export default function RedirectedRoute() {
  return null;
}
