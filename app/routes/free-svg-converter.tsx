import type { Route } from "./+types/free-svg-converter";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "Free SVG Converter - Redirect | iLoveSVG";
  const description =
    "Free SVG Converter is consolidated into the iLoveSVG home converter hub to avoid duplicate pages.";
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
