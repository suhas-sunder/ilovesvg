import type { Route } from "./+types/svg-color-changer";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "SVG Color Changer - Redirect | iLoveSVG";
  const description =
    "SVG Color Changer is consolidated into the SVG Recolor tool to avoid duplicate pages.";
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
