import type { Route } from "./+types/svg-code-cleaner";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "SVG Code Cleaner - Redirect | iLoveSVG";
  const description = "SVG Code Cleaner is consolidated into the most relevant iLoveSVG tool to avoid duplicate pages.";
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: "https://www.ilovesvg.com/svg-cleaner" },
  ];
}

export function loader() {
  return redirect("/svg-cleaner", 301);
}

export default function RedirectedRoute() {
  return null;
}
