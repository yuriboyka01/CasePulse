'use client';

import React, { useEffect, useRef } from 'react';

export interface ConstellationNode {
  id: string;
  label: string;
  count: number;
}

interface BureauConstellationProps {
  nodes: ConstellationNode[];
  coreLabel?: string;
  className?: string;
}

interface Palette {
  brand: string;
  brandStrong: string;
  ink: string;
  muted: string;
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** Deterministic pseudo-random so the dust field is stable between renders. */
function seeded(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function readPalette(): Palette {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  return {
    brand: read('--brand', '#4A5535'),
    brandStrong: read('--brand-strong', '#384227'),
    ink: read('--ink', '#191E1B'),
    muted: read('--ink-muted', '#4A5535'),
  };
}

const DUST = Array.from({ length: 42 }, (_, i) => ({
  angle: seeded(i + 1) * Math.PI * 2,
  radius: 0.3 + seeded(i + 99) * 1.05,
  lift: seeded(i + 7) - 0.5,
  speed: 0.015 + seeded(i + 31) * 0.045,
  size: 0.6 + seeded(i + 57) * 1.1,
}));

/**
 * Perspective-projected orbit of bureau nodes around the Joint Desk core.
 * Node size reflects real case volume. The spokes only connect each bureau to the
 * shared desk â€” no line between bureaus is ever drawn, so no relationship between
 * complaints is implied. Motion is ambient and stops for reduced-motion users.
 */
export function BureauConstellation({ nodes, coreLabel = 'JOINT DESK', className = '' }: BureauConstellationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef(nodes);

  useEffect(() => {
    nodesRef.current = nodes;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let palette = readPalette();
    let width = 0;
    let height = 0;
    let frameId = 0;
    let running = false;
    let inView = true;
    let time = 0;
    let lastFrame = 0;
    const pointer = { x: 0, y: 0, active: false, tx: 0, ty: 0, nx: 0, ny: 0 };

    const draw = () => {
      const list = nodesRef.current;
      ctx.clearRect(0, 0, width, height);
      if (width === 0 || height === 0) return;

      const cx = width * 0.5;
      const cy = height * 0.5;
      const ring = Math.min(width * 0.32, height * 0.70);
      const tilt = 1.02 + pointer.ny * 0.1;
      const yaw = time * 0.16 + pointer.nx * 0.35;
      const focal = ring * 4.2;
      const cosT = Math.cos(tilt);
      const sinT = Math.sin(tilt);

      const project = (x: number, y: number, z: number) => {
        const y1 = y * cosT - z * sinT;
        const z1 = y * sinT + z * cosT;
        const scale = focal / (focal - z1);
        return { x: cx + x * scale, y: cy + y1 * scale, depth: z1 / ring, scale };
      };

      // Orbit guides
      ctx.lineWidth = 1;
      ctx.strokeStyle = palette.muted;
      for (const factor of [1, 0.62]) {
        ctx.globalAlpha = factor === 1 ? 0.2 : 0.12;
        ctx.beginPath();
        for (let step = 0; step <= 96; step++) {
          const a = (step / 96) * Math.PI * 2;
          const p = project(Math.cos(a) * ring * factor, 0, Math.sin(a) * ring * factor);
          if (step === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }

      // Drifting dust (purely decorative)
      ctx.fillStyle = palette.brandStrong;
      for (const mote of DUST) {
        const a = mote.angle + time * mote.speed;
        const p = project(Math.cos(a) * ring * mote.radius, mote.lift * ring * 0.9, Math.sin(a) * ring * mote.radius);
        ctx.globalAlpha = Math.max(0.05, 0.28 + p.depth * 0.22);
        ctx.beginPath();
        ctx.arc(p.x, p.y, mote.size * p.scale, 0, Math.PI * 2);
        ctx.fill();
      }

      const maxCount = Math.max(1, ...list.map((n) => n.count));
      const placed = list
        .map((node, index) => {
          const a = yaw + (index / Math.max(list.length, 1)) * Math.PI * 2;
          const p = project(Math.cos(a) * ring, 0, Math.sin(a) * ring);
          const radius = (5 + Math.sqrt(node.count / maxCount) * 9) * p.scale;
          return { node, p, radius };
        })
        .sort((a, b) => a.p.depth - b.p.depth);

      let hoveredId: string | null = null;
      if (pointer.active) {
        let best = Infinity;
        for (const item of placed) {
          const dist = Math.hypot(pointer.x - item.p.x, pointer.y - item.p.y);
          if (dist < item.radius + 12 && dist < best) {
            best = dist;
            hoveredId = item.node.id;
          }
        }
      }

      const core = project(0, 0, 0);
      const drawCore = () => {
        const glow = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, 58);
        glow.addColorStop(0, palette.brand);
        glow.addColorStop(1, 'transparent');
        ctx.globalAlpha = 0.42;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(core.x, core.y, 58, 0, Math.PI * 2);
        ctx.fill();

        const pulse = reduceMotion ? 0 : Math.sin(time * 1.5) * 1.8;
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = palette.brandStrong;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(core.x, core.y, 19 + pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 1;
        ctx.fillStyle = palette.brand;
        ctx.beginPath();
        ctx.arc(core.x, core.y, 11, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.85;
        ctx.fillStyle = palette.muted;
        ctx.font = `600 9px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillText(coreLabel, core.x, core.y + 36);
      };

      const drawNode = (item: (typeof placed)[number]) => {
        const { node, p, radius } = item;
        const depthAlpha = Math.min(1, Math.max(0.28, 0.62 + p.depth * 0.55));
        const hovered = hoveredId === node.id;

        // Spoke to the shared desk only
        ctx.globalAlpha = depthAlpha * 0.28;
        ctx.strokeStyle = palette.brand;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(core.x, core.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        const body = ctx.createRadialGradient(p.x - radius * 0.35, p.y - radius * 0.35, radius * 0.1, p.x, p.y, radius);
        body.addColorStop(0, palette.brandStrong);
        body.addColorStop(1, palette.brand);
        ctx.globalAlpha = depthAlpha;
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (hovered) {
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = palette.ink;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius + 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.globalAlpha = hovered ? 1 : Math.max(depthAlpha, 0.75);
        ctx.fillStyle = palette.ink;
        ctx.font = `${hovered ? 700 : 600} 10.5px ${MONO}`;
        ctx.textAlign = 'center';
        const text = hovered ? `${node.label} · ${node.count.toLocaleString('en-IN')} cases` : node.label;
        ctx.fillText(text, p.x, p.y - radius - 7);
      };

      for (const item of placed) if (item.p.depth < 0) drawNode(item);
      drawCore();
      for (const item of placed) if (item.p.depth >= 0) drawNode(item);
      ctx.globalAlpha = 1;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const frame = (now: number) => {
      const dt = Math.min((now - lastFrame) / 1000, 0.05);
      lastFrame = now;
      time += dt;
      pointer.nx += (pointer.tx - pointer.nx) * 0.06;
      pointer.ny += (pointer.ty - pointer.ny) * 0.06;
      draw();
      frameId = window.requestAnimationFrame(frame);
    };

    const start = () => {
      if (reduceMotion || running || !inView || document.hidden) return;
      running = true;
      lastFrame = performance.now();
      frameId = window.requestAnimationFrame(frame);
    };

    const stop = () => {
      running = false;
      window.cancelAnimationFrame(frameId);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
      pointer.tx = (pointer.x / Math.max(rect.width, 1) - 0.5) * 2;
      pointer.ty = (pointer.y / Math.max(rect.height, 1) - 0.5) * 2;
      if (reduceMotion) {
        pointer.nx = pointer.tx;
        pointer.ny = pointer.ty;
        draw();
      }
    };

    const onPointerLeave = () => {
      pointer.active = false;
      pointer.tx = 0;
      pointer.ty = 0;
      if (reduceMotion) {
        pointer.nx = 0;
        pointer.ny = 0;
        draw();
      }
    };

    const onVisibility = () => (document.hidden ? stop() : start());

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? true;
      if (inView) start();
      else stop();
    });
    intersectionObserver.observe(canvas);

    const themeObserver = new MutationObserver(() => {
      palette = readPalette();
      draw();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);

    resize();
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [coreLabel]);

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        role="img"
        aria-label={`Bureau caseload constellation: ${nodes.map((n) => `${n.label} ${n.count} cases`).join(', ')}`}
      />
    </div>
  );
}
