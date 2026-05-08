import type { Route } from "./+types/svg-to-react-component";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "SVG to React Component - Redirect | iLoveSVG";
  const description = "SVG to React Component is consolidated into the most relevant iLoveSVG tool to avoid duplicate pages.";
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: "https://www.ilovesvg.com/svg-to-jsx-converter" },
  ];
}

export function loader() {
  return redirect("/svg-to-jsx-converter", 301);
}

export default function RedirectedRoute() {
  return null;
}
