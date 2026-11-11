import type { ProcessorResult } from './processors';
import { ProcessorError } from './processors';
import QRCode from 'qrcode';

export async function runTextTool(
  tool: string,
  file: File,
  options: Record<string, unknown> = {}
): Promise<ProcessorResult> {
  const input = file ? await file.text() : '';

  if (tool === 'qr-generator') {
    if (!input.trim()) throw new ProcessorError('Enter the text or URL to put in the QR code.');
    const dataUrl = await QRCode.toDataURL(input.trim(), {
      width: Number(options.size ?? 512),
      margin: 2,
      errorCorrectionLevel: 'M',
    });
    const blob = await (await fetch(dataUrl)).blob();
    return {
      blob,
      filename: 'qr-code.png',
      mimeType: 'image/png',
      meta: { width: Number(options.size ?? 512), outputSize: blob.size },
    };
  }

  throw new ProcessorError('This text tool does not have a processor in this build.', 'NOT_IMPLEMENTED');
}
