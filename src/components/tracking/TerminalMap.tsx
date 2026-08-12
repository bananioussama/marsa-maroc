import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EquipmentState, Journey } from "@/lib/tracking/engine";

export type YardSlot = { id: string; flow: "IMPORT" | "EXPORT"; reefer: boolean; hazardous: boolean; delayed: boolean; transit: boolean };
export type YardBlock = { block: string; slots: YardSlot[] };

type Props = {
  blocks: YardBlock[];
  sts: EquipmentState[];
  rtg: EquipmentState[];
  tt: EquipmentState[];
  journey: Journey | null;
  showRoutes: boolean;
  onSelectContainer: (id: string) => void;
  onSelectEquipment: (e: EquipmentState) => void;
  onSelectZone: (zone: string) => void;
  tick: number;
};

const W = 1240;
const H = 780;

const slotColor = (s: YardSlot, selected: boolean) => {
  if (selected) return "var(--color-primary)";
  if (s.delayed) return "var(--color-destructive)";
  if (s.transit) return "var(--color-chart-4)";
  if (s.reefer) return "var(--color-chart-6)";
  if (s.hazardous) return "var(--color-warning)";
  return s.flow === "IMPORT" ? "var(--color-info)" : "var(--color-chart-3)";
};

export function TerminalMap({
  blocks, sts, rtg, tt, journey, showRoutes, onSelectContainer, onSelectEquipment, onSelectZone, tick,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, z: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const handleWheel = useCallback((e: WheelEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    const v = viewRef.current;
    const next = Math.min(3, Math.max(0.6, v.z * Math.exp(-dy * 0.0015)));
    const k = next / v.z;
    setView({ z: next, x: px - (px - v.x) * k, y: py - (py - v.y) * k });
  }, []);
  const wheelRef = useRef(handleWheel);
  wheelRef.current = handleWheel;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); wheelRef.current(e); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const blockLayout = useMemo(() => {
    const cols = 5;
    return blocks.slice(0, 10).map((b, i) => ({
      ...b,
      x: 70 + (i % cols) * 228,
      y: 330 + Math.floor(i / cols) * 190,
    }));
  }, [blocks]);

  const selectedBlock = journey?.yardBlock;
  const target = blockLayout.find((b) => b.block === selectedBlock);
  const isImport = journey?.container.flow !== "EXPORT";
  const stage = journey?.stageIndex ?? -1;

  const routePoints = useMemo(() => {
    if (!journey || !showRoutes) return [] as { x: number; y: number; label: string }[];
    const yardPt = target ? { x: target.x + 100, y: target.y + 60 } : { x: 400, y: 420 };
    const vessel = { x: 540, y: 110, label: "VESSEL" };
    const stsPt = { x: 540, y: 230, label: "STS" };
    const quay = { x: 540, y: 268, label: "QUAY" };
    const yard = { ...yardPt, label: `YARD ${selectedBlock || ""}` };
    const gate = { x: 1120, y: 700, label: "GATE" };
    return isImport
      ? [vessel, stsPt, quay, yard, gate]
      : [gate, yard, quay, stsPt, vessel];
  }, [journey, showRoutes, target, selectedBlock, isImport]);

  const dash = tick % 40;

  return (
    <div
      ref={ref}
      className="relative h-[560px] w-full cursor-grab overflow-hidden rounded-2xl border border-border/60 bg-[oklch(0.16_0.03_255)] active:cursor-grabbing"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY, ox: view.x, oy: view.y };
        (e.target as Element).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        setView((v) => ({ ...v, x: drag.current!.ox + e.clientX - drag.current!.x, y: drag.current!.oy + e.clientY - drag.current!.y }));
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerLeave={() => (drag.current = null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full select-none" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`, transformOrigin: "0 0" }}>
        <defs>
          <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.32 0.09 235)" />
            <stop offset="100%" stopColor="oklch(0.22 0.06 240)" />
          </linearGradient>
          <linearGradient id="asphalt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.24 0.02 255)" />
            <stop offset="100%" stopColor="oklch(0.19 0.02 255)" />
          </linearGradient>
        </defs>

        {/* WATER */}
        <rect x="0" y="0" width={W} height="205" fill="url(#sea)" />
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            d={`M ${-40 + ((tick * 1.5 + i * 60) % 80)} ${30 + i * 38} q 20 -8 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0`}
            stroke="oklch(0.55 0.08 230 / 0.25)" fill="none" strokeWidth="2"
          />
        ))}
        <text x="24" y="30" className="fill-[oklch(0.75_0.06_230)]" fontSize="13" letterSpacing="3">WATER — ATLANTIC</text>

        {/* VESSEL */}
        <g onClick={() => onSelectZone("VESSEL")} className="cursor-pointer">
          <path d="M 190 70 L 900 70 L 940 130 L 230 130 Z" fill="oklch(0.3 0.04 255)" stroke="var(--color-border)" />
          <rect x="200" y="34" width="700" height="38" rx="4" fill="oklch(0.26 0.03 255)" stroke="var(--color-border)" />
          {Array.from({ length: 24 }).map((_, i) => (
            <rect key={i} x={210 + i * 28} y={i % 2 ? 40 : 76} width="24" height="22" rx="2"
              fill={i === 7 && journey && stage <= 1 ? "var(--color-primary)" : ["var(--color-info)", "var(--color-chart-3)", "var(--color-chart-6)", "var(--color-chart-5)"][i % 4]}
              opacity={i === 7 && journey && stage <= 1 ? 1 : 0.75} />
          ))}
          <text x="200" y="26" className="fill-foreground" fontSize="14" fontWeight="600">
            🚢 {journey?.container.vessel ?? "CONTAINER VESSEL"} {journey ? `· ${journey.container.voyage}` : ""}
          </text>
        </g>

        {/* QUAY */}
        <rect x="0" y="205" width={W} height="70" fill="url(#asphalt)" />
        <rect x="0" y="205" width={W} height="6" fill="var(--color-primary)" opacity="0.5" />
        <text x="24" y="250" fontSize="15" letterSpacing="6" className="fill-muted-foreground">Q U A Y   —   TCE / TC3</text>

        {/* STS CRANES */}
        {sts.slice(0, 6).map((c, i) => {
          const x = 250 + i * 150;
          const working = c.status === "WORKING";
          const trolley = working ? x - 40 + ((tick * 4 + i * 30) % 90) : x;
          const active = journey?.equipment === c.id;
          return (
            <g key={c.id} onClick={(e) => { e.stopPropagation(); onSelectEquipment(c); }} className="cursor-pointer">
              <rect x={x - 46} y={140} width="92" height="8" fill={active ? "var(--color-primary)" : "oklch(0.5 0.03 255)"} />
              <rect x={x - 4} y={148} width="8" height="60" fill="oklch(0.45 0.03 255)" />
              <rect x={x - 34} y={148} width="6" height="60" fill="oklch(0.4 0.03 255)" />
              <rect x={x + 28} y={148} width="6" height="60" fill="oklch(0.4 0.03 255)" />
              <rect x={trolley - 8} y={140} width="16" height="10" fill={working ? "var(--color-primary)" : "oklch(0.6 0.02 255)"} />
              {working && <rect x={trolley - 7} y={150} width="14" height="12" rx="2" fill="var(--color-chart-5)" />}
              <circle cx={x + 40} cy={136} r="4" fill={working ? "var(--color-success)" : "var(--color-muted-foreground)"}>
                {working && <animate attributeName="opacity" values="1;0.2;1" dur="1.4s" repeatCount="indefinite" />}
              </circle>
              <text x={x} y={132} textAnchor="middle" fontSize="11" className="fill-foreground">{c.id}</text>
            </g>
          );
        })}

        {/* INTERNAL TRUCKS */}
        {tt.slice(0, 6).map((t, i) => {
          const p = ((tick * 2 + i * 45) % 180) / 180;
          const x = 120 + i * 180;
          const y = 285 + p * 30;
          return (
            <g key={t.id} transform={`translate(${x}, ${y})`} onClick={(e) => { e.stopPropagation(); onSelectEquipment(t); }} className="cursor-pointer">
              <rect x="0" y="0" width="34" height="13" rx="3" fill={t.status === "WORKING" ? "var(--color-chart-5)" : "oklch(0.45 0.02 255)"} />
              <circle cx="7" cy="14" r="3" fill="oklch(0.3 0.02 255)" />
              <circle cx="27" cy="14" r="3" fill="oklch(0.3 0.02 255)" />
              <text x="0" y="-4" fontSize="9" className="fill-muted-foreground">{t.id}</text>
            </g>
          );
        })}

        {/* YARD */}
        <text x="70" y="318" fontSize="13" letterSpacing="5" className="fill-muted-foreground">Y A R D</text>
        {blockLayout.map((b) => {
          const crane = rtg.find((r) => r.container && b.slots.some((s) => s.id === r.container));
          const highlight = b.block === selectedBlock;
          return (
            <g key={b.block}>
              <rect x={b.x} y={b.y} width="200" height="150" rx="10"
                fill="oklch(0.21 0.025 255)" stroke={highlight ? "var(--color-primary)" : "var(--color-border)"} strokeWidth={highlight ? 2 : 1}
                onClick={() => onSelectZone(`YARD ${b.block}`)} className="cursor-pointer" />
              <text x={b.x + 12} y={b.y + 22} fontSize="13" fontWeight="600" className="fill-foreground">{b.block}</text>
              <text x={b.x + 188} y={b.y + 22} fontSize="11" textAnchor="end" className="fill-muted-foreground">{b.slots.length}</text>
              {b.slots.slice(0, 42).map((s, i) => {
                const sel = journey?.container.id === s.id;
                return (
                  <rect key={s.id} x={b.x + 12 + (i % 14) * 13} y={b.y + 34 + Math.floor(i / 14) * 16}
                    width="11" height="13" rx="2" fill={slotColor(s, sel)} opacity={sel ? 1 : 0.85}
                    stroke={sel ? "var(--color-foreground)" : "none"} strokeWidth={sel ? 1.5 : 0}
                    onClick={(e) => { e.stopPropagation(); onSelectContainer(s.id); }} className="cursor-pointer">
                    {sel && <animate attributeName="opacity" values="1;0.35;1" dur="1.2s" repeatCount="indefinite" />}
                  </rect>
                );
              })}
              {/* RTG gantry */}
              <g onClick={(e) => { e.stopPropagation(); if (crane) onSelectEquipment(crane); }} className="cursor-pointer">
                <rect x={b.x - 6} y={b.y - 12} width="212" height="7" rx="3" fill={crane ? "var(--color-chart-1)" : "oklch(0.4 0.02 255)"} />
                <rect x={b.x - 6} y={b.y - 12} width="7" height="24" fill="oklch(0.4 0.02 255)" />
                <rect x={b.x + 199} y={b.y - 12} width="7" height="24" fill="oklch(0.4 0.02 255)" />
                <text x={b.x + 100} y={b.y - 18} textAnchor="middle" fontSize="10" className="fill-muted-foreground">
                  RTG {crane ? `· ${crane.id} WORKING` : "· idle"}
                </text>
              </g>
            </g>
          );
        })}

        {/* GATE */}
        <g onClick={() => onSelectZone("GATE")} className="cursor-pointer">
          <rect x="1010" y="620" width="210" height="140" rx="10" fill="oklch(0.21 0.025 255)" stroke="var(--color-border)" />
          <text x="1115" y="646" textAnchor="middle" fontSize="13" letterSpacing="4" className="fill-foreground">G A T E</text>
          {["TRUCK", "CHECK", "OCR", "GATE OUT"].map((s, i) => (
            <g key={s}>
              <rect x="1030" y={658 + i * 24} width="170" height="18" rx="4" fill="oklch(0.26 0.03 255)" />
              <rect x="1030" y={658 + i * 24} width={((tick * 3 + i * 40) % 170)} height="18" rx="4" fill="var(--color-primary)" opacity="0.18" />
              <text x="1040" y={671 + i * 24} fontSize="10" className="fill-foreground">🚛 {s}</text>
            </g>
          ))}
        </g>

        {/* SELECTED CONTAINER ROUTE */}
        {routePoints.length > 1 && (
          <g pointerEvents="none">
            <polyline
              points={routePoints.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeDasharray="10 8" strokeDashoffset={-dash} opacity="0.9"
            />
            {routePoints.map((p, i) => (
              <g key={p.label + i}>
                <circle cx={p.x} cy={p.y} r="8" fill="var(--color-background)" stroke="var(--color-primary)" strokeWidth="2" />
                <circle cx={p.x} cy={p.y} r="4" fill="var(--color-primary)">
                  <animate attributeName="r" values="4;7;4" dur="1.6s" begin={`${i * 0.2}s`} repeatCount="indefinite" />
                </circle>
                <text x={p.x + 12} y={p.y - 10} fontSize="11" className="fill-primary">{p.label}</text>
              </g>
            ))}
            {target && (
              <text x={target.x + 100} y={target.y + 66} textAnchor="middle" fontSize="20" className="fill-primary">★</text>
            )}
          </g>
        )}
      </svg>

      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-lg bg-background/70 px-3 py-2 text-[10px] text-muted-foreground backdrop-blur">
        {[["Import", "var(--color-info)"], ["Export", "var(--color-chart-3)"], ["Reefer", "var(--color-chart-6)"], ["Hazard", "var(--color-warning)"], ["Delayed", "var(--color-destructive)"], ["In transit", "var(--color-chart-4)"], ["Selected", "var(--color-primary)"]].map(([l, c]) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c }} />{l}
          </span>
        ))}
      </div>
      <div className="absolute right-3 top-3 flex gap-1.5">
        {[["+", 1.25], ["−", 0.8]].map(([l, k]) => (
          <button key={l as string} onClick={() => setView((v) => {
            const next = Math.min(3, Math.max(0.6, v.z * (k as number)));
            const kk = next / v.z;
            return { z: next, x: 620 - (620 - v.x) * kk, y: 280 - (280 - v.y) * kk };
          })} className="h-8 w-8 rounded-md border border-border/60 bg-background/80 text-sm text-foreground backdrop-blur hover:border-primary/60">{l}</button>
        ))}
        <button onClick={() => setView({ x: 0, y: 0, z: 1 })} className="h-8 rounded-md border border-border/60 bg-background/80 px-2 text-[11px] text-foreground backdrop-blur hover:border-primary/60">Reset</button>
      </div>
    </div>
  );
}
