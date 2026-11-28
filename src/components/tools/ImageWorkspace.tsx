import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, Copy, Check, Download, RefreshCw, Palette, Pipette,
  Sliders, Eye, Sparkles, Image as ImageIcon, ZoomIn, Info,
} from 'lucide-react';
import type { Tool } from '@/registry/tools';
import { nativeSaveFile } from '@/lib/platform';

interface ImageWorkspaceProps {
  tool: Tool;
  color: string;
}

export const ImageWorkspace: React.FC<ImageWorkspaceProps> = ({ tool, color }) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Color Picker State
  const [pickedColor, setPickedColor] = useState<{ hex: string; rgb: string; hsl: string } | null>(null);
  const [hoverColor, setHoverColor] = useState<{ hex: string; rgb: string } | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [copiedHex, setCopiedHex] = useState(false);

  // Palette State
  const [palette, setPalette] = useState<{ hex: string; rgb: string; percentage: number }[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Cleanup object URLs on unmount or file change
  useEffect(() => {
    return () => {
      if (imageSrc && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [imageSrc]);

  // Handle uploaded file
  const handleFileChange = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (imageSrc && imageSrc.startsWith('blob:')) {
      URL.revokeObjectURL(imageSrc);
    }

    const url = URL.createObjectURL(file);
    setImageFile(file);
    setImageSrc(url);
    setPickedColor(null);
    setPalette([]);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      // Draw onto hidden full-resolution canvas for sampling
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        canvasRef.current = canvas;
      }

      // If palette tool, extract automatically
      if (tool.slug === 'image-palette-extractor') {
        extractPaletteFromImage(img);
      } else {
        // Sample center pixel by default for color picker
        samplePixel(Math.floor(img.naturalWidth / 2), Math.floor(img.naturalHeight / 2));
      }
    };
    img.src = url;
  }, [imageSrc, tool.slug]);

  const samplePixel = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const px = Math.max(0, Math.min(canvas.width - 1, x));
    const py = Math.max(0, Math.min(canvas.height - 1, y));
    const p = ctx.getImageData(px, py, 1, 1).data;

    const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
    const hex = `#${toHex(p[0])}${toHex(p[1])}${toHex(p[2])}`;
    const rgb = `rgb(${p[0]}, ${p[1]}, ${p[2]})`;

    // Convert to HSL
    const r = p[0] / 255, g = p[1] / 255, b = p[2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    const hsl = `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;

    setPickedColor({ hex, rgb, hsl });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = naturalSize.width / rect.width;
    const scaleY = naturalSize.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    setCursorPos({ x, y });

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const px = Math.max(0, Math.min(canvas.width - 1, x));
    const py = Math.max(0, Math.min(canvas.height - 1, y));
    const p = ctx.getImageData(px, py, 1, 1).data;
    const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
    setHoverColor({
      hex: `#${toHex(p[0])}${toHex(p[1])}${toHex(p[2])}`,
      rgb: `rgb(${p[0]}, ${p[1]}, ${p[2]})`,
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = naturalSize.width / rect.width;
    const scaleY = naturalSize.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    samplePixel(x, y);
  };

  const extractPaletteFromImage = (img: HTMLImageElement) => {
    setIsExtracting(true);
    setTimeout(() => {
      try {
        const sampleSize = 100;
        const downCanvas = document.createElement('canvas');
        downCanvas.width = sampleSize;
        downCanvas.height = sampleSize;
        const ctx = downCanvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

        const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
        const buckets = new Map<number, { r: number; g: number; b: number; count: number }>();

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 50) continue;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
          const bkt = buckets.get(key);
          if (bkt) {
            bkt.r += r; bkt.g += g; bkt.b += b; bkt.count++;
          } else {
            buckets.set(key, { r, g, b, count: 1 });
          }
        }

        const sorted = Array.from(buckets.values()).sort((a, b) => b.count - a.count);
        const colors: { hex: string; rgb: string; percentage: number }[] = [];
        const total = sorted.reduce((sum, item) => sum + item.count, 0) || 1;

        for (const item of sorted) {
          const avgR = Math.round(item.r / item.count);
          const avgG = Math.round(item.g / item.count);
          const avgB = Math.round(item.b / item.count);
          const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
          const hex = `#${toHex(avgR)}${toHex(avgG)}${toHex(avgB)}`;

          const isDuplicate = colors.some((c) => {
            const m = c.hex.match(/#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})/i);
            if (!m) return false;
            const r2 = parseInt(m[1], 16), g2 = parseInt(m[2], 16), b2 = parseInt(m[3], 16);
            return Math.hypot(avgR - r2, avgG - g2, avgB - b2) < 36;
          });

          if (!isDuplicate) {
            colors.push({
              hex,
              rgb: `rgb(${avgR}, ${avgG}, ${avgB})`,
              percentage: +((item.count / total) * 100).toFixed(1),
            });
          }
          if (colors.length >= 6) break;
        }

        setPalette(colors);
      } finally {
        setIsExtracting(false);
      }
    }, 50);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHex(true);
    setTimeout(() => setCopiedHex(false), 2000);
  };

  const downloadSwatchOrPalette = async () => {
    if (tool.slug === 'image-palette-extractor' && palette.length > 0) {
      const cardCanvas = document.createElement('canvas');
      cardCanvas.width = 600;
      cardCanvas.height = 360;
      const ctx = cardCanvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 600, 360);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText('CONVET PULSE — Extracted Color Palette', 24, 38);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText(`${palette.length} Dominant Colors • 100% Client-Side Extraction`, 24, 60);

      const barWidth = Math.floor(552 / palette.length);
      palette.forEach((p, idx) => {
        const x = 24 + idx * barWidth;
        ctx.fillStyle = p.hex;
        ctx.fillRect(x, 80, barWidth - 4, 190);

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(p.hex, x + 4, 296);

        ctx.fillStyle = '#64748b';
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillText(`${p.percentage}%`, x + 4, 314);
      });

      cardCanvas.toBlob((blob) => {
        if (blob) nativeSaveFile(blob, `${imageFile?.name.replace(/\.[^.]+$/, '') || 'image'}_palette.png`);
      });
    } else if (pickedColor) {
      const swatchCanvas = document.createElement('canvas');
      swatchCanvas.width = 400;
      swatchCanvas.height = 240;
      const ctx = swatchCanvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = pickedColor.hex;
      ctx.fillRect(0, 0, 400, 150);

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 150, 400, 90);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText(pickedColor.hex, 20, 185);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(`${pickedColor.rgb} • ${pickedColor.hsl}`, 20, 212);

      swatchCanvas.toBlob((blob) => {
        if (blob) nativeSaveFile(blob, `color_swatch_${pickedColor.hex.replace('#', '')}.png`);
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Banner */}
      {!imageSrc ? (
        <label
          htmlFor="image-workspace-upload"
          className="border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-hover-cv"
          style={{ borderColor: 'var(--border)' }}
        >
          <input
            id="image-workspace-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/bmp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileChange(e.target.files[0]);
              }
            }}
          />
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
            style={{ backgroundColor: `${color}15`, color }}
          >
            {tool.slug === 'image-palette-extractor' ? <Palette size={32} /> : <Pipette size={32} />}
          </div>
          <h3 className="text-base font-bold text-primary mb-1">
            Upload Image to {tool.slug === 'image-palette-extractor' ? 'Extract Palette' : 'Inspect Colors'}
          </h3>
          <p className="text-xs text-muted-cv max-w-sm mb-4">
            Supports PNG, JPEG, WebP, SVG, and BMP. Processed 100% locally on your device.
          </p>
          <span className="btn-primary btn-sm gap-2" style={{ backgroundColor: color }}>
            <Upload size={14} /> Select Image
          </span>
        </label>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Interactive Canvas Area */}
          <div className="lg:col-span-2 space-y-3">
            <div
              className="p-3 rounded-2xl border flex items-center justify-between text-xs"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2">
                <ImageIcon size={15} style={{ color }} />
                <span className="font-semibold text-primary">{imageFile?.name}</span>
                <span className="text-muted-cv">
                  ({naturalSize.width} × {naturalSize.height} px)
                </span>
              </div>
              <label
                htmlFor="image-workspace-replace"
                className="btn-secondary btn-xs gap-1 cursor-pointer"
              >
                <input
                  id="image-workspace-replace"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/bmp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                />
                <RefreshCw size={11} /> Change Image
              </label>
            </div>

            {/* Interactive Image Container */}
            <div
              className="relative rounded-2xl border overflow-hidden flex items-center justify-center p-2 select-none"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
                minHeight: '380px',
              }}
            >
              <img
                src={imageSrc}
                alt="Upload preview"
                className="max-h-[500px] w-auto object-contain cursor-crosshair rounded-lg shadow-sm"
                onMouseMove={handleCanvasMouseMove}
                onClick={handleCanvasClick}
              />

              {/* Live Loupe / Hover indicator */}
              {hoverColor && cursorPos && (
                <div
                  className="absolute pointer-events-none px-2 py-1 rounded shadow-lg text-[11px] font-mono font-bold flex items-center gap-1.5 border"
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    top: Math.max(10, Math.min(460, cursorPos.y / (naturalSize.height / 500) - 40)),
                    left: Math.max(10, Math.min(500, cursorPos.x / (naturalSize.width / 500) + 15)),
                  }}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-white/40 flex-shrink-0"
                    style={{ backgroundColor: hoverColor.hex }}
                  />
                  <span>{hoverColor.hex}</span>
                </div>
              )}
            </div>

            <p className="text-2xs text-muted-cv flex items-center gap-1.5">
              <Info size={12} />
              {tool.slug === 'image-palette-extractor'
                ? 'Colors are automatically grouped and weighted by dominant visual presence.'
                : 'Hover to preview pixel color. Click anywhere on the image to sample and lock the color.'}
            </p>
          </div>

          {/* Right Sidebar: Color Swatches & Details */}
          <div className="space-y-4">
            {tool.slug === 'image-palette-extractor' ? (
              /* Color Palette Panel */
              <div
                className="p-5 rounded-2xl border space-y-4"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <Palette size={16} style={{ color }} />
                    <h3 className="text-sm font-bold text-primary">Extracted Palette</h3>
                  </div>
                  <span className="badge badge-neutral text-2xs">{palette.length} Colors</span>
                </div>

                {isExtracting ? (
                  <div className="py-12 text-center text-xs text-muted-cv">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-primary" />
                    Extracting color harmony...
                  </div>
                ) : palette.length > 0 ? (
                  <div className="space-y-2.5">
                    {palette.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all hover:bg-hover-cv"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-8 h-8 rounded-lg border border-black/10 shadow-inner flex-shrink-0"
                            style={{ backgroundColor: item.hex }}
                          />
                          <div>
                            <p className="text-xs font-bold font-mono text-primary">{item.hex}</p>
                            <p className="text-[10px] text-muted-cv font-mono">{item.rgb}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-secondary">
                            {item.percentage}%
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.hex)}
                            className="p-1.5 rounded-lg border hover:bg-hover-cv text-muted-cv hover:text-primary transition-colors"
                            style={{ borderColor: 'var(--border)' }}
                            title="Copy HEX"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={downloadSwatchOrPalette}
                      className="btn-primary btn-sm w-full gap-2 mt-4"
                      style={{ backgroundColor: color }}
                    >
                      <Download size={13} /> Download Palette Card (.PNG)
                    </button>
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-muted-cv">
                    No palette generated yet.
                  </div>
                )}
              </div>
            ) : (
              /* Color Picker Panel */
              <div
                className="p-5 rounded-2xl border space-y-4"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <Pipette size={16} style={{ color }} />
                    <h3 className="text-sm font-bold text-primary">Sampled Color</h3>
                  </div>
                  {copiedHex && (
                    <span className="badge badge-success text-2xs flex items-center gap-1">
                      <Check size={10} /> Copied!
                    </span>
                  )}
                </div>

                {pickedColor ? (
                  <div className="space-y-4">
                    {/* Big Color Preview Box */}
                    <div
                      className="h-28 rounded-xl shadow-inner border border-black/10 relative overflow-hidden flex items-end p-3"
                      style={{ backgroundColor: pickedColor.hex }}
                    >
                      <span className="px-2.5 py-1 rounded-md text-xs font-mono font-extrabold bg-black/60 text-white backdrop-blur-sm">
                        {pickedColor.hex}
                      </span>
                    </div>

                    {/* Values list */}
                    <div className="space-y-2 text-xs">
                      <div
                        className="p-2.5 rounded-xl border flex items-center justify-between"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
                      >
                        <span className="text-muted-cv font-medium">HEX</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-primary">{pickedColor.hex}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(pickedColor.hex)}
                            className="p-1 rounded hover:bg-hover-cv text-muted-cv hover:text-primary"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>

                      <div
                        className="p-2.5 rounded-xl border flex items-center justify-between"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
                      >
                        <span className="text-muted-cv font-medium">RGB</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-primary">{pickedColor.rgb}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(pickedColor.rgb)}
                            className="p-1 rounded hover:bg-hover-cv text-muted-cv hover:text-primary"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>

                      <div
                        className="p-2.5 rounded-xl border flex items-center justify-between"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
                      >
                        <span className="text-muted-cv font-medium">HSL</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-primary">{pickedColor.hsl}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(pickedColor.hsl)}
                            className="p-1 rounded hover:bg-hover-cv text-muted-cv hover:text-primary"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={downloadSwatchOrPalette}
                      className="btn-primary btn-sm w-full gap-2"
                      style={{ backgroundColor: color }}
                    >
                      <Download size={13} /> Download Swatch (.PNG)
                    </button>
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-muted-cv">
                    Click anywhere on the image to pick a color.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
