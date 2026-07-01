import type { Route } from "./+types/change-svg-color-online";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "Change SVG Color Online - Redirect | iLoveSVG";
  const description =
    "Change SVG Color Online is consolidated into the SVG Recolor tool to avoid duplicate pages.";
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
