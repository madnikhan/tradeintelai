/**
 * Render OHLC close prices to a canvas image for vision analysis (browser only).
 */

import type { PriceData } from '@/types/trading';

export function renderOhlcChartBase64(
  data: PriceData[],
  symbol: string,
  width = 640,
  height = 360
): string | null {
  if (typeof document === 'undefined' || !data || data.length < 10) {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const prices = data.map((d) => d.close);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = (max - min) * 0.08 || 0.001;
  const yMin = min - pad;
  const yMax = max + pad;
  const range = yMax - yMin || 1;

  ctx.fillStyle = '#0f1419';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#1e2738';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = 40 + ((height - 60) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(50, y);
    ctx.lineTo(width - 20, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px sans-serif';
  ctx.fillText(`${symbol} H1 (${data.length} bars)`, 52, 24);

  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const chartW = width - 70;
  const chartH = height - 60;
  prices.forEach((p, i) => {
    const x = 50 + (i / (prices.length - 1)) * chartW;
    const y = 40 + chartH - ((p - yMin) / range) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  const last = prices[prices.length - 1];
  ctx.fillStyle = '#22d3ee';
  ctx.font = '12px sans-serif';
  ctx.fillText(last.toFixed(5), width - 100, 30);

  try {
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    return base64 || null;
  } catch {
    return null;
  }
}
