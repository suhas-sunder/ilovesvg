import type { Route } from "./+types/svg-background-remover";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "SVG Background Remover - Redirect | iLoveSVG";
  const description =
    "SVG Background Remover is consolidated into the SVG Background Editor to avoid duplicate pages.";
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
