import type { Route } from "./+types/recolor-svg";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "Recolor SVG - Redirect | iLoveSVG";
  const description =
    "Recolor SVG is consolidated into the SVG Recolor tool to avoid duplicate pages.";
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: "https://www.ilovesvg.com/svg-recolor" },
  ];
}

export function loader() {
  return redirect("/svg-recolor", 301);
}

export default function RedirectedRoute() {
  return null;
}
