// Front-component workers cannot drive a real browser download; the host must.
export const downloadQuotationPdfFromHost = ({
  fileName,
  pdfBase64,
}: {
  fileName: string;
  pdfBase64: string;
}): void => {
  const binary = atob(pdfBase64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes], { type: 'application/pdf' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
};
