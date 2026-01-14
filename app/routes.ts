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
  route("cookies", "routes/cookies.tsx"),
  route("privacy-policy", "routes/privacy-policy.tsx"),
  route("terms-of-service", "routes/terms-of-service.tsx"),
] satisfies RouteConfig;
