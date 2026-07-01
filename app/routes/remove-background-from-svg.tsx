import type { Route } from "./+types/remove-background-from-svg";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "Remove Background From SVG - Redirect | iLoveSVG";
  const description =
    "Remove Background From SVG is consolidated into the SVG Background Editor to avoid duplicate pages.";
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
