import type { Route } from "./+types/remove-svg-background";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "Remove SVG Background - Redirect | iLoveSVG";
  const description =
    "Remove SVG Background is consolidated into the SVG Background Editor to avoid duplicate pages.";
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: "https://www.ilovesvg.com/svg-background-editor" },
  ];
}

export function loader() {
  return redirect("/svg-background-editor", 301);
}

export default function RedirectedRoute() {
  return null;
}
