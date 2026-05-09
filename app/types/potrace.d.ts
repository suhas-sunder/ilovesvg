declare module "potrace" {
  import type { Buffer } from "node:buffer";

  export interface PotraceOptions {
    turdPolicy?: "minority" | "majority" | "black" | "white" | "left" | "right";
    turdSize?: number;
    alphaMax?: number;
    optCurve?: boolean;
    optTolerance?: number;
    threshold?: number;
    blackOnWhite?: boolean;
    color?: string | "auto";
    background?: string | "transparent";
  }

  export interface PosterizerOptions extends PotraceOptions {
    steps?: number;
    fillStrategy?: string | "dominant";
    rangeDistribution?: string | "auto";
  }

  export type PotraceImageInput = string | Buffer | ArrayBuffer | Uint8Array;

  export function trace(
    file: PotraceImageInput,
    cb: (error: Error | null, svg: string, potrace: Potrace) => void,
  ): void;

  export function trace(
    file: PotraceImageInput,
    options: PotraceOptions,
    cb: (error: Error | null, svg: string, potrace: Potrace) => void,
  ): void;

  export function posterize(
    file: PotraceImageInput,
    cb: (error: Error | null, svg: string, posterizer: Posterizer) => void,
  ): void;

  export function posterize(
    file: PotraceImageInput,
    options: PosterizerOptions,
    cb: (error: Error | null, svg: string, posterizer: Posterizer) => void,
  ): void;

  export class Posterizer {
    constructor(options?: PosterizerOptions);
    loadImage(
      image: PotraceImageInput,
      callback: (posterizer: Posterizer, error: Error | null) => void,
    ): void;
    setParameters(params: PotraceOptions): void;
    getSVG(): string;
    getSymbol(id: string): string;
  }

  export class Potrace {
    constructor(options?: PotraceOptions);
    loadImage(
      image: PotraceImageInput,
      callback: (potrace: Potrace, error: Error | null) => void,
    ): void;
    setParameters(params: PotraceOptions): void;
    getSVG(): string;
    getSymbol(id: string): string;
    getPathTag(fillColor: string, scale: number): string;
  }
}
