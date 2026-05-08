import type { Route } from "./+types/svg-to-data-uri-converter";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  const title = "SVG to Data URI Converter - Redirect | iLoveSVG";
  const description = "SVG to Data URI Converter is consolidated into the most relevant iLoveSVG tool to avoid duplicate pages.";
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: "https://www.ilovesvg.com/svg-to-base64" },
  ];
}

export function loader() {
  return redirect("/svg-to-base64", 301);
}

export default function RedirectedRoute() {
  return null;
}
