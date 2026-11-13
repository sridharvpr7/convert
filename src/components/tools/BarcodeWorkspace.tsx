import React, { useState, useMemo, useRef } from 'react';
import {
  Download, Printer, AlertCircle, CheckCircle2, RefreshCw, Sparkles, Copy, Check,
} from 'lucide-react';
import {
  type BarcodeFormat,
  validateBarcodeFormat,
  generateBarcodeModules,
  renderBarcodeSvg,
} from '@/lib/barcodeTools';

interface BarcodeWorkspaceProps {
  color: string;
}

const FORMAT_SAMPLES: Record<BarcodeFormat, { sample: string; hint: string }> = {
  code128: { sample: 'CONVET-PULSE-2026', hint: 'Standard alphanumeric (ASCII 32-126)' },
  ean13: { sample: '9780201379624', hint: '12 or 13 numeric digits (ISBN / Retail)' },
  upca: { sample: '012345678905', hint: '11 or 12 numeric digits (Retail USA / Canada)' },
  ean8: { sample: '96385074', hint: '7 or 8 numeric digits (Small retail packaging)' },
  code39: { sample: 'CONVET 99', hint: 'Uppercase letters (A-Z), digits (0-9), and -.$/+%' },
  itf: { sample: '123456789012', hint: 'Even number of numeric digits (Carton shipping)' },
  codabar: { sample: 'A123456789B', hint: 'Digits 0-9 with start/stop A, B, C, D (Libraries)' },
};

export const BarcodeWorkspace: React.FC<BarcodeWorkspaceProps> = ({ color }) => {
  const [format, setFormat] = useState<BarcodeFormat>('code128');
  const [text, setText] = useState<string>('CONVET-12345');
  const [width, setWidth] = useState<number>(2);
  const [height, setHeight] = useState<number>(80);
  const [margin, setMargin] = useState<number>(15);
  const [displayValue, setDisplayValue] = useState<boolean>(true);
  const [lineColor, setLineColor] = useState<string>('#000000');
  const [background, setBackground] = useState<string>('#ffffff');
  const [copied, setCopied] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);

  // Validate format and text
  const validation = useMemo(() => {
    return validateBarcodeFormat(format, text);
  }, [format, text]);

  // Generate SVG string
  const svgOutput = useMemo(() => {
    if (!validation.valid || !validation.normalized) return null;
    try {
      const { modules, normalizedText } = generateBarcodeModules(format, validation.normalized);
      return renderBarcodeSvg(modules, normalizedText, {
        format,
        width,
        height,
        margin,
        displayValue,
        lineColor,
        background,
      });
    } catch {
      return null;
    }
  }, [format, validation, width, height, margin, displayValue, lineColor, background]);

  const handleDownloadSvg = () => {
    if (!svgOutput) return;
    const blob = new Blob([svgOutput], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barcode-${format}-${validation.normalized || 'code'}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPng = () => {
    if (!svgOutput) return;
    const img = new Image();
    const svgBlob = new Blob([svgOutput], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((b) => {
          if (b) {
            const pngUrl = URL.createObjectURL(b);
            const a = document.createElement('a');
            a.href = pngUrl;
            a.download = `barcode-${format}-${validation.normalized || 'code'}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(pngUrl);
          }
        }, 'image/png');
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handlePrint = () => {
    if (!svgOutput) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>Print Barcode - ${validation.normalized}</title>
    <style>
      body {
        margin: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        font-family: sans-serif;
      }
      .barcode-box {
        text-align: center;
        padding: 20px;
      }
      @media print {
        body { min-height: auto; }
      }
    </style>
  </head>
  <body>
    <div class="barcode-box">
      ${svgOutput}
    </div>
    <script>
      window.onload = function() {
        window.print();
        setTimeout(function() { window.close(); }, 500);
      };
    </script>
  </body>
</html>`);
    printWindow.document.close();
  };

  const handleCopySvg = async () => {
    if (!svgOutput) return;
    try {
      await navigator.clipboard.writeText(svgOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleSetSample = () => {
    const s = FORMAT_SAMPLES[format];
    setText(s.sample);
  };

  return (
    <div className="space-y-6">
      {/* Configuration Grid */}
      <div
        className="p-6 rounded-2xl border shadow-sm space-y-5"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center justify-between border-b pb-4 flex-wrap gap-2" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="text-base font-bold text-primary">Barcode Parameters</h2>
            <p className="text-xs text-muted-cv">Customize format, dimension scaling, and colors with live rendering</p>
          </div>
          <button
            type="button"
            onClick={handleSetSample}
            className="btn-secondary btn-xs gap-1.5"
            title="Load valid sample value for this format"
          >
            <Sparkles size={12} style={{ color }} />
            Load Sample
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Format Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-primary">Barcode Format</label>
            <select
              value={format}
              onChange={(e) => {
                const nextFmt = e.target.value as BarcodeFormat;
                setFormat(nextFmt);
                setText(FORMAT_SAMPLES[nextFmt].sample);
              }}
              className="input-md w-full rounded-xl border text-xs font-medium"
              style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
            >
              <option value="code128">Code 128 (Standard Alphanumeric)</option>
              <option value="ean13">EAN-13 (13-Digit Retail / Grocery)</option>
              <option value="upca">UPC-A (12-Digit Retail USA / Canada)</option>
              <option value="ean8">EAN-8 (8-Digit Compact Retail)</option>
              <option value="code39">Code 39 (Industrial &amp; Military)</option>
              <option value="itf">ITF (Interleaved 2 of 5 - Logistics)</option>
              <option value="codabar">Codabar (Libraries &amp; Blood Banks)</option>
            </select>
            <p className="text-2xs text-muted-cv">{FORMAT_SAMPLES[format].hint}</p>
          </div>

          {/* Text Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-primary">Data / Text Value</label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter barcode value..."
              className="input-md w-full rounded-xl border font-mono text-xs font-medium"
              style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
            />
            {validation.valid ? (
              <p className="text-2xs text-success-600 flex items-center gap-1">
                <CheckCircle2 size={11} /> Format valid: {validation.normalized}
              </p>
            ) : (
              <p className="text-2xs text-danger-500 flex items-center gap-1 font-medium">
                <AlertCircle size={11} /> {validation.error}
              </p>
            )}
          </div>

          {/* Output Controls */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-primary">Text Label</label>
            <div className="pt-2">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-secondary font-medium">
                <input
                  type="checkbox"
                  checked={displayValue}
                  onChange={(e) => setDisplayValue(e.target.checked)}
                  className="checkbox checkbox-sm"
                />
                Show text below barcode
              </label>
            </div>
          </div>
        </div>

        {/* Sliders & Color Adjustments */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          {/* Bar Width Scale */}
          <div className="space-y-1">
            <div className="flex justify-between text-2xs text-muted-cv">
              <span>Bar Width</span>
              <span className="font-mono">{width}px</span>
            </div>
            <input
              type="range"
              min={1}
              max={4}
              step={1}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {/* Height */}
          <div className="space-y-1">
            <div className="flex justify-between text-2xs text-muted-cv">
              <span>Height</span>
              <span className="font-mono">{height}px</span>
            </div>
            <input
              type="range"
              min={40}
              max={160}
              step={10}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {/* Quiet Zone Margin */}
          <div className="space-y-1">
            <div className="flex justify-between text-2xs text-muted-cv">
              <span>Margin</span>
              <span className="font-mono">{margin}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              step={5}
              value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {/* Colors */}
          <div className="flex items-center gap-3">
            <div className="space-y-1 flex-1">
              <label className="text-2xs text-muted-cv block">Bar Color</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={lineColor}
                  onChange={(e) => setLineColor(e.target.value)}
                  className="w-7 h-7 rounded border cursor-pointer p-0"
                />
                <span className="text-2xs font-mono">{lineColor}</span>
              </div>
            </div>
            <div className="space-y-1 flex-1">
              <label className="text-2xs text-muted-cv block">Background</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                  className="w-7 h-7 rounded border cursor-pointer p-0"
                />
                <span className="text-2xs font-mono">{background}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Preview Display */}
      <div
        className="p-8 rounded-2xl border flex flex-col items-center justify-center min-h-[260px] shadow-sm relative overflow-hidden"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {svgOutput ? (
          <div className="flex flex-col items-center gap-6">
            <div
              ref={previewRef}
              className="p-4 rounded-xl border shadow-md inline-block transition-transform hover:scale-105 duration-200"
              style={{ backgroundColor: background, borderColor: 'rgba(0,0,0,0.1)' }}
              dangerouslySetInnerHTML={{ __html: svgOutput }}
            />

            {/* Quick Actions */}
            <div className="flex items-center gap-2.5 flex-wrap justify-center">
              <button
                type="button"
                onClick={handleDownloadPng}
                className="btn-primary btn-sm gap-1.5 font-bold shadow-md"
                style={{ backgroundColor: color, color: '#ffffff' }}
              >
                <Download size={13} />
                Download PNG
              </button>

              <button
                type="button"
                onClick={handleDownloadSvg}
                className="btn-secondary btn-sm gap-1.5 font-semibold"
              >
                <Download size={13} />
                Download SVG
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="btn-secondary btn-sm gap-1.5 font-semibold"
              >
                <Printer size={13} />
                Print Barcode
              </button>

              <button
                type="button"
                onClick={handleCopySvg}
                className="btn-ghost btn-sm gap-1.5 text-muted-cv hover:text-primary"
                title="Copy SVG markup"
              >
                {copied ? <Check size={13} className="text-success-500" /> : <Copy size={13} />}
                <span>{copied ? 'Copied SVG' : 'Copy SVG'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center p-8 max-w-md">
            <AlertCircle size={32} className="text-amber-500 mx-auto mb-3" />
            <p className="text-sm font-bold text-primary mb-1">Cannot Generate Barcode</p>
            <p className="text-xs text-muted-cv leading-relaxed">
              {validation.error || 'Please check your input data and format requirements.'}
            </p>
            <button
              type="button"
              onClick={handleSetSample}
              className="btn-secondary btn-sm gap-1.5 mt-4"
            >
              <RefreshCw size={12} /> Reset to Valid Sample
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

