import type { Route } from "./+types/image-to-outline-converter";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "Image to Outline Converter - Redirect | iLoveSVG";
  const description =
    "Image to Outline Converter is consolidated into the Image to SVG Outline tool to avoid duplicate pages.";
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: "https://www.ilovesvg.com/image-to-svg-outline" },
  ];
}

export function loader() {
  return redirect("/image-to-svg-outline", 301);
}

export default function RedirectedRoute() {
  return null;
}
