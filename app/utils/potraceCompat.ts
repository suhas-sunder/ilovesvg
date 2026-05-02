type PotraceModule = typeof import("potrace");

let potraceModule: PotraceModule | null = null;

export async function getPotrace(): Promise<PotraceModule> {
  if (!potraceModule) {
    potraceModule = await import("potrace");
  }
  return potraceModule;
}

export async function traceBitmapToSvg(
  input: Buffer,
  options: Record<string, unknown>,
): Promise<string> {
  const potrace = await getPotrace();
  const traceFn: any = (potrace as any).trace;
  const PotraceClass: any = (potrace as any).Potrace;

  return await new Promise((resolve, reject) => {
    if (typeof traceFn === "function") {
      traceFn(input, options, (err: unknown, out: string) =>
        err ? reject(err) : resolve(out),
      );
      return;
    }

    if (PotraceClass) {
      const tracer = new PotraceClass(options);
      tracer.loadImage(input, (err: unknown) => {
        if (err) {
          reject(err);
          return;
        }

        tracer.setParameters(options);
        tracer.getSVG((svgError: unknown, out: string) =>
          svgError ? reject(svgError) : resolve(out),
        );
      });
      return;
    }

    reject(new Error("potrace API not found"));
  });
}
