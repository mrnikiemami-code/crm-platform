declare module 'fontkit' {
  type FontHandle = {
    _layoutEngine: unknown;
  };

  export function openSync(path: string): FontHandle;
}

declare module '@react-pdf/pdfkit' {
  export class EmbeddedFont {
    static prototype: Record<string, unknown>;
  }
}