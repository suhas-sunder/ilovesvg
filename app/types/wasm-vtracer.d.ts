declare module "wasm_vtracer/wasm_vtracer_bg.js" {
  export enum ColorMode {
    Color = 0,
    Binary = 1,
  }

  export enum Hierarchical {
    Stacked = 0,
    Cutout = 1,
  }

  export enum PathSimplifyMode {
    Polygon = 0,
    Spline = 1,
    None = 2,
  }

  export class TracerConfig {
    constructor();
    free(): void;
    presetLineArt(): void;
    presetPhoto(): void;
    presetPixelArt(): void;
    setColorMode(mode: ColorMode): void;
    setColorPrecision(value: number): void;
    setCornerThreshold(value: number): void;
    setFilterSpeckle(value: number): void;
    setHierarchical(mode: Hierarchical): void;
    setLayerDifference(value: number): void;
    setLengthThreshold(value: number): void;
    setMaxIterations(value: number): void;
    setPathPrecision(value: number): void;
    setPathSimplifyMode(mode: PathSimplifyMode): void;
    setSpliceThreshold(value: number): void;
  }

  export function __wbg_set_wasm(value: WebAssembly.Exports): void;
  export function convertImageToSvg(
    imageData: Uint8Array,
    width: number,
    height: number,
    config: TracerConfig,
  ): string;
  export function init(): void;
  export function isReady(): boolean;

  export function __wbg_Error_52673b7de5a0ca89(...args: unknown[]): unknown;
  export function __wbg___wbindgen_throw_dd24417ed36fc46e(...args: unknown[]): unknown;
  export function __wbg_error_7534b8e9a36f1ab4(...args: unknown[]): unknown;
  export function __wbg_new_8a6f238a6ece86ea(...args: unknown[]): unknown;
  export function __wbg_stack_0ed75d68575b0f3c(...args: unknown[]): unknown;
  export function __wbindgen_object_drop_ref(...args: unknown[]): unknown;
}

declare module "*.wasm?url" {
  const url: string;
  export default url;
}
