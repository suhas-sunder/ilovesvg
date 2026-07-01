import type { Route } from "./+types/svg-converter";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "SVG Converter - Redirect | iLoveSVG";
  const description =
    "SVG Converter is consolidated into the iLoveSVG home converter hub to avoid duplicate pages.";
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
