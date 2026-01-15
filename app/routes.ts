import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("svg-to-png-converter", "routes/svg-to-png-converter.tsx"),
  route("svg-to-jpg-converter", "routes/svg-to-jpg-converter.tsx"),
  route("svg-to-webp-converter", "routes/svg-to-webp-converter.tsx"),
  route("svg-background-editor", "routes/svg-background-editor.tsx"),
  route(
    "svg-resize-and-scale-editor",
    "routes/svg-resize-and-scale-editor.tsx"
  ),
  route("svg-recolor", "routes/svg-recolor.tsx"),
  route("svg-minifier", "routes/svg-minifier.tsx"),
  route("svg-preview-viewer", "routes/svg-preview-viewer.tsx"),
  route("svg-to-base64", "routes/svg-to-base64.tsx"),
  route("base64-to-svg", "routes/base64-to-svg.tsx"),
  route("svg-to-pdf-converter", "routes/svg-to-pdf-converter.tsx"),
  route("svg-cleaner", "routes/svg-cleaner.tsx"),
  route("svg-embed-code-generator", "routes/svg-embed-code-generator.tsx"),
  route("inline-svg-vs-img", "routes/inline-svg-vs-img.tsx"),
  route("svg-to-favicon-generator", "routes/svg-to-favicon-generator.tsx"),
  route("svg-stroke-width-editor", "routes/svg-stroke-width-editor.tsx"),
  route("svg-flip-and-rotate-editor", "routes/svg-flip-and-rotate-editor.tsx"),
  route("svg-dimensions-inspector", "routes/svg-dimensions-inspector.tsx"),
  route("svg-size-inspector", "routes/svg-size-inspector.tsx"),
  route("free-color-picker", "routes/free-color-picker.tsx"),
  route(
    "svg-accessibility-and-contrast-checker",
    "routes/svg-accessibility-and-contrast-checker.tsx"
  ),
  route("cookies", "routes/cookies.tsx"),
  route("privacy-policy", "routes/privacy-policy.tsx"),
  route("terms-of-service", "routes/terms-of-service.tsx"),
] satisfies RouteConfig;
