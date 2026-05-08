import type { Route } from "./+types/svg-inline-code-generator";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "SVG Inline Code Generator - Redirect | iLoveSVG";
  const description = "SVG Inline Code Generator is consolidated into the most relevant iLoveSVG tool to avoid duplicate pages.";
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: "https://www.ilovesvg.com/svg-embed-code-generator" },
  ];
}

export function loader() {
  return redirect("/svg-embed-code-generator", 301);
}

export default function RedirectedRoute() {
  return null;
}
