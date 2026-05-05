declare module "culori" {
  export type RgbColor = {
    mode: "rgb";
    r: number;
    g: number;
    b: number;
    alpha?: number;
  };

  export function differenceCiede2000(
    Kl?: number,
    Kc?: number,
    Kh?: number,
  ): (standard: RgbColor, sample: RgbColor) => number;
}
