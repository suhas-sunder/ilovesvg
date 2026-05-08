import type { Route } from "./+types/svg-transparent-background-tool";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "SVG Transparent Background Tool - Redirect | iLoveSVG";
  const description = "SVG Transparent Background Tool is consolidated into the most relevant iLoveSVG tool to avoid duplicate pages.";
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
