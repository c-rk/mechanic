declare module 'jpeg-js/lib/decoder' {
  interface DecodeOptions {
    useTArray?: boolean;
    formatAsRGBA?: boolean;
    maxMemoryUsageInMB?: number;
  }
  export default function decode(
    data: Uint8Array | ArrayBuffer,
    opts?: DecodeOptions,
  ): { width: number; height: number; data: Uint8Array };
}
