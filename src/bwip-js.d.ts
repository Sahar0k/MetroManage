declare module 'bwip-js' {
  interface BwipJsOpts {
    bcid: string;
    text: string;
    scale?: number;
    width?: number;
    height?: number;
    includetext?: boolean;
    rotate?: 'N' | 'R' | 'L' | 'I';
    [key: string]: any;
  }

  interface BwipJs {
    toCanvas(canvas: HTMLCanvasElement, opts: BwipJsOpts): void;
    toCanvas(id: string, opts: BwipJsOpts): void;
    toBuffer(opts: BwipJsOpts): Buffer;
  }

  const bwipjs: BwipJs;
  export default bwipjs;
}
