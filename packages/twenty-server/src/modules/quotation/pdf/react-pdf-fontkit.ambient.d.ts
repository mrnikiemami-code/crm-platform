declare module 'fontkit' {
  type FontHandle = {
    _layoutEngine: unknown;
  };

  export function openSync(path: string): FontHandle;
}

declare module '@react-pdf/pdfkit' {
  // Instance methods are patched at runtime via EmbeddedFont.prototype; do not
  // declare a static `prototype` field — Babel/lingui reject that shape.
  export class EmbeddedFont {}
}