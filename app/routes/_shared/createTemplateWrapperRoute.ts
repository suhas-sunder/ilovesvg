type TemplateWrapperRouteConfig<TPath extends string, TMeta, TComponent> = {
  path: TPath;
  createMeta: (path: TPath) => TMeta;
  Component: TComponent;
};

export function createTemplateWrapperRoute<TPath extends string, TMeta, TComponent>(
  config: TemplateWrapperRouteConfig<TPath, TMeta, TComponent>,
) {
  return {
    meta: () => config.createMeta(config.path),
    Component: config.Component,
  } as const;
}
