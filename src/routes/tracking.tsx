import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Anchor, Boxes, Brain, Clock, Container as ContainerIcon,
  FileText, Gauge, Home, Pause, Play, RefreshCw, Route as RouteIcon, Search, Ship, Truck, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TerminalMap, type YardBlock } from "@/components/tracking/TerminalMap";
import { excelJsonSource, type Dataset, type Movement } from "@/lib/tracking/source";
import {
  buildJourney, buildReport, computeKpis, equipmentStates, blockOf,
  type Anomaly, type EquipmentState, type Journey, type Severity,
} from "@/lib/tracking/engine";
import marsaLogo from "@/assets/marsa-maroc-logo.png.asset.json";

export const Route = createFileRoute("/tracking")({
  component: TrackingPage,
  head: () => ({
    meta: [
      { title: "Live Container Tracking — Marsa Maroc Casablanca" },
      { name: "description", content: "Centre de contrôle temps réel du terminal à conteneurs de Casablanca : jumeau numérique 2D, parcours conteneur navire → gate, anomalies opérationnelles et rapports." },
      { property: "og:title", content: "Live Container Tracking — Marsa Maroc Casablanca" },
      { property: "og:description", content: "Digital twin 2D du terminal : STS, RTG, tracteurs internes, yard, gate, timeline conteneur et détection d'anomalies." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const SECTIONS = ["LIVE OPERATIONS", "CONTAINER TRACKING", "VESSEL", "YARD", "EQUIPMENT", "ANOMALIES", "ANALYTICS", "REPORTS"] as const;

const SEV_STYLE: Record<Severity, { dot: string; text: string; label: string }> = {
  NORMAL: { dot: "bg-success", text: "text-success", label: "🟢 NORMAL" },
  WARNING: { dot: "bg-warning", text: "text-warning", label: "🟡 WARNING" },
  DELAY: { dot: "bg-chart-5", text: "text-chart-5", label: "🟠 DELAY" },
  CRITICAL: { dot: "bg-destructive", text: "text-destructive", label: "🔴 CRITICAL" },
};

const fmtTime = (t: number) =>
  new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const fmtDate = (t: number) =>
  new Date(t).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function Kpi({ icon: Icon, label, value, tone = "text-foreground" }: { icon: React.ElementType; label: string; value: string | number; tone?: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-surface-gradient p-4 shadow-elegant">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <p className={`font-display mt-2 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function Panel({ id, title, action, children }: { id?: string; title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="rounded-2xl border border-border/60 bg-surface-gradient p-5 shadow-elegant">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function TrackingPage() {
  const [data, setData] = useState<Dataset | null>(null);
  const [now, setNow] = useState(0);
  const [live, setLive] = useState(true);
  const [speed, setSpeed] = useState(5);
  const [selected, setSelected] = useState<string | null>(null);
  const [flow, setFlow] = useState<"ALL" | "IMPORT" | "EXPORT">("ALL");
  const [terminal, setTerminal] = useState("all");
  const [vessel, setVessel] = useState("all");
  const [cheType, setCheType] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [showRoutes, setShowRoutes] = useState(true);
  const [tick, setTick] = useState(0);
  const [event, setEvent] = useState<Movement | null>(null);
  const [equip, setEquip] = useState<EquipmentState | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  const [report, setReport] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const clock = useRef(0);

  useEffect(() => {
    excelJsonSource.load().then((d) => {
      setData(d);
      const start = d.range[0] + (d.range[1] - d.range[0]) * 0.6;
      clock.current = start;
      setNow(start);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 120);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (!live || !data) return;
    const i = setInterval(() => {
      clock.current = Math.min(data.range[1], clock.current + speed * 60_000);
      setNow(clock.current);
      setLastUpdate(Date.now());
    }, 1000);
    return () => clearInterval(i);
  }, [live, speed, data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.containers.filter((c) =>
      (flow === "ALL" || c.flow === flow) &&
      (terminal === "all" || c.terminal === terminal) &&
      (vessel === "all" || c.vessel === vessel) &&
      (!q || c.id.toLowerCase().includes(q.toLowerCase()) || c.vessel.toLowerCase().includes(q.toLowerCase())),
    );
  }, [data, flow, terminal, vessel, q]);

  const journeys = useMemo(() => {
    if (!data) return [] as Journey[];
    const out: Journey[] = [];
    for (const c of filtered) {
      const j = buildJourney(data, c.id, now);
      if (!j) continue;
      if (status !== "all") {
        const st = j.finished ? "COMPLETED" : j.started ? (j.inTransit ? "IN TRANSIT" : "IN YARD") : "EXPECTED";
        if (st !== status) continue;
      }
      out.push(j);
    }
    return out;
  }, [data, filtered, now, status]);

  const kpis = useMemo(() => (data ? computeKpis(journeys, data, now) : null), [journeys, data, now]);

  const ids = useMemo(() => new Set(journeys.map((j) => j.container.id)), [journeys]);
  const equipment = useMemo(() => (data ? equipmentStates(data, now, ids) : []), [data, now, ids]);
  const visibleEquipment = useMemo(
    () => (cheType === "all" ? equipment : equipment.filter((e) => e.type === cheType)),
    [equipment, cheType],
  );

  const journey = useMemo(() => (data && selected ? buildJourney(data, selected, now) : null), [data, selected, now]);

  const blocks: YardBlock[] = useMemo(() => {
    const map = new Map<string, YardBlock>();
    for (const j of journeys) {
      if (!j.started || j.finished) continue;
      const b = j.yardBlock;
      if (!b) continue;
      let e = map.get(b);
      if (!e) { e = { block: b, slots: [] }; map.set(b, e); }
      if (e.slots.length < 42)
        e.slots.push({
          id: j.container.id,
          flow: j.container.flow,
          reefer: j.container.reefer,
          hazardous: j.container.hazardous,
          delayed: j.severity === "DELAY" || j.severity === "CRITICAL",
          transit: j.inTransit,
        });
    }
    if (journey?.yardBlock && !map.get(journey.yardBlock)?.slots.some((s) => s.id === journey.container.id)) {
      const e = map.get(journey.yardBlock) ?? { block: journey.yardBlock, slots: [] };
      e.slots.unshift({ id: journey.container.id, flow: journey.container.flow, reefer: journey.container.reefer, hazardous: journey.container.hazardous, delayed: false, transit: journey.inTransit });
      map.set(journey.yardBlock, e);
    }
    return [...map.values()].sort((a, b) => a.block.localeCompare(b.block));
  }, [journeys, journey]);

  const anomalies = useMemo(() => {
    const all = journeys.flatMap((j) => j.anomalies);
    return all.sort((a, b) => b.time - a.time).slice(0, 40);
  }, [journeys]);

  const gate = useMemo(() => {
    if (!data) return { waiting: 0, processing: 0, done: 0, avg: 0 };
    const g = data.movements.filter((m) => ids.has(m.containerId) && (m.event === "GATE_OUT" || m.event === "GATE_IN"));
    const done = g.filter((m) => m.end <= now);
    const processing = g.filter((m) => m.start <= now && m.end >= now);
    const waiting = data.movements.filter((m) => ids.has(m.containerId) && m.event === "TRUCK_ARRIVAL" && m.time <= now && m.time > now - 3600_000).length;
    const avg = done.length ? Math.round(done.reduce((s, m) => s + m.duration, 0) / done.length) : 0;
    return { waiting, processing: processing.length, done: done.length, avg };
  }, [data, ids, now]);

  const vessels = useMemo(() => (data ? [...new Set(data.containers.map((c) => c.vessel))].sort() : []), [data]);
  const activeCalls = useMemo(
    () => (data ? data.vessels.filter((v) => v.ata <= now && v.atd >= now - 6 * 3600_000).slice(0, 8) : []),
    [data, now],
  );

  if (!data || !kpis) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background bg-hero">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin" /> Chargement du jumeau numérique du terminal…
        </div>
      </div>
    );
  }

  const scrollTo = (s: string) => document.getElementById(s.replace(/\s+/g, "-").toLowerCase())?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="min-h-screen bg-background bg-hero">
      {/* TOP BAR */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-5 py-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white p-1 ring-1 ring-border/60">
              <img src={marsaLogo.url} alt="Logo Marsa Maroc" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="font-display text-sm font-semibold leading-none">Marsa Maroc · Casablanca</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Container Operational Tracking</p>
            </div>
          </Link>

          <div className="ml-2 flex items-center gap-2">
            <Badge variant="outline" className="border-destructive/50 bg-destructive/10 text-destructive">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />LIVE
            </Badge>
            <span className="font-display text-sm tabular-nums text-foreground">{fmtDate(now)}</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              Last update {fmtTime(lastUpdate)} · next +1s
            </span>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button size="sm" variant={live ? "default" : "outline"} onClick={() => setLive((v) => !v)}>
              {live ? <><Pause className="mr-1.5 h-3.5 w-3.5" />Pause Live</> : <><Play className="mr-1.5 h-3.5 w-3.5" />Live Simulation</>}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setNow(clock.current); setLastUpdate(Date.now()); }}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />Refresh
            </Button>
            <Select value={String(speed)} onValueChange={(v) => setSpeed(Number(v))}>
              <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 5, 15, 60].map((s) => <SelectItem key={s} value={String(s)}>Auto play ×{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Link to="/assistant"><Button size="sm" variant="outline"><Brain className="mr-1.5 h-3.5 w-3.5" />Marsa IA</Button></Link>
            <Link to="/"><Button size="sm" variant="ghost"><Home className="h-3.5 w-3.5" /></Button></Link>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-5 pb-2">
          {SECTIONS.map((s) => (
            <button key={s} onClick={() => scrollTo(s)}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-surface hover:text-primary">
              {s}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-6 px-5 py-6">
        {/* FILTERS */}
        <section id="live-operations" className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-surface/60 p-3">
          <div className="relative min-w-[280px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Container ID (ex. MSCU100000000)…" className="h-11 pl-9" />
          </div>
          <div className="flex rounded-lg border border-border/60 p-1">
            {(["ALL", "IMPORT", "EXPORT"] as const).map((f) => (
              <button key={f} onClick={() => setFlow(f)}
                className={`rounded-md px-4 py-1.5 text-xs font-semibold tracking-wide transition-colors ${flow === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {f}
              </button>
            ))}
          </div>
          {[
            { v: terminal, set: setTerminal, label: "Terminal", opts: ["TCE", "TC3"] },
            { v: cheType, set: setCheType, label: "CHE Type", opts: ["STS", "RTG", "TT", "RS"] },
            { v: status, set: setStatus, label: "Status", opts: ["IN YARD", "IN TRANSIT", "COMPLETED", "EXPECTED"] },
          ].map((s) => (
            <Select key={s.label} value={s.v} onValueChange={s.set}>
              <SelectTrigger className="h-11 w-[190px]"><SelectValue placeholder={s.label} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{s.label} — tous</SelectItem>
                {s.opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          ))}
          <Select value={vessel} onValueChange={setVessel}>
            <SelectTrigger className="h-11 w-[230px]"><SelectValue placeholder="Vessel" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Vessel — tous</SelectItem>
              {vessels.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant={showRoutes ? "default" : "outline"} className="h-11" onClick={() => setShowRoutes((v) => !v)}>
            <RouteIcon className="mr-1.5 h-4 w-4" />Routes
          </Button>
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi icon={ContainerIcon} label="Active containers" value={kpis.activeContainers} />
          <Kpi icon={Activity} label="Active movements" value={kpis.activeMovements} tone="text-info" />
          <Kpi icon={Boxes} label="Containers in yard" value={kpis.inYard} tone="text-chart-3" />
          <Kpi icon={Truck} label="Containers in transit" value={kpis.inTransit} tone="text-chart-4" />
          <Kpi icon={Clock} label="Delayed containers" value={kpis.delayed} tone="text-chart-5" />
          <Kpi icon={AlertTriangle} label="Active exceptions" value={kpis.activeExceptions} tone="text-destructive" />
        </section>

        {/* 2D TERMINAL */}
        <Panel
          id="container-tracking"
          title={<span className="flex items-center gap-2"><Anchor className="h-4 w-4 text-primary" />Digital twin 2D — {flow === "EXPORT" ? "GATE → VESSEL" : "VESSEL → GATE"}</span>}
          action={<span className="text-[11px] text-muted-foreground">Molette = zoom · glisser = déplacer · clic = détails</span>}
        >
          <TerminalMap
            blocks={blocks}
            sts={visibleEquipment.filter((e) => e.type === "STS")}
            rtg={visibleEquipment.filter((e) => e.type === "RTG")}
            tt={visibleEquipment.filter((e) => e.type === "TT" || e.type === "RS")}
            journey={journey}
            showRoutes={showRoutes}
            tick={tick}
            onSelectContainer={setSelected}
            onSelectEquipment={setEquip}
            onSelectZone={setZone}
          />
          {zone && (
            <p className="mt-3 text-xs text-muted-foreground">Zone sélectionnée : <span className="text-primary">{zone}</span> — {blocks.find((b) => `YARD ${b.block}` === zone)?.slots.length ?? gate.done} unités traitées.</p>
          )}
        </Panel>

        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            {/* PROFILE + PROGRESS */}
            <Panel
              title="Container profile & journey progress"
              action={journey && <Button size="sm" variant="outline" onClick={() => setReport(true)}><FileText className="mr-1.5 h-3.5 w-3.5" />Generate container report</Button>}
            >
              {!journey ? (
                <p className="text-sm text-muted-foreground">Sélectionne un conteneur (recherche, liste ou clic dans le yard) pour afficher son parcours complet.</p>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-display text-xl font-semibold">{journey.container.id}</span>
                    <Badge variant="outline" className="border-primary/50 text-primary">{journey.container.flow}</Badge>
                    <Badge variant="outline">{journey.container.iso} · {journey.container.length} FT</Badge>
                    <Badge variant="outline">{(journey.container.weight / 1000).toFixed(1)} TON</Badge>
                    {journey.container.reefer && <Badge variant="outline" className="border-chart-6/50 text-chart-6">REEFER</Badge>}
                    {journey.container.hazardous && <Badge variant="outline" className="border-warning/50 text-warning">HAZARDOUS</Badge>}
                    <span className={`ml-auto text-xs font-semibold ${SEV_STYLE[journey.severity].text}`}>{SEV_STYLE[journey.severity].label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                    {[
                      ["Shipping line", journey.container.line],
                      ["Vessel", `${journey.container.vessel} · ${journey.container.voyage}`],
                      ["Terminal", journey.container.terminal],
                      ["Current position", journey.position],
                      ["Current status", journey.finished ? "COMPLETED" : journey.inTransit ? "IN TRANSIT" : journey.yardBlock ? "IN YARD" : "IN OPERATION"],
                      ["Last equipment", journey.equipment],
                      ["Elapsed", `${Math.floor(journey.elapsedMin / 60)}h ${journey.elapsedMin % 60}m`],
                      ["Movements", `${journey.events.length}/${journey.events.length + journey.pending.length}`],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-lg border border-border/50 bg-surface/50 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
                        <p className="mt-1 font-medium text-foreground">{v}</p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Container journey progress</span>
                      <span className="font-display font-semibold text-primary">{journey.progress}%</span>
                    </div>
                    <div className="relative h-2 rounded-full bg-surface-2">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-[image:var(--gradient-primary)] transition-all duration-700" style={{ width: `${journey.progress}%` }} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {journey.stages.map((s, i) => (
                        <span key={s} className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold tracking-wide transition-colors ${
                          i < journey.stageIndex ? "border-success/40 bg-success/10 text-success"
                          : i === journey.stageIndex ? "border-primary bg-primary/15 text-primary"
                          : "border-border/50 text-muted-foreground"}`}>
                          {s}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Current stage : <span className="text-foreground">{journey.stages[journey.stageIndex]}</span> · Next stage :{" "}
                      <span className="text-foreground">{journey.nextStage ?? (journey.finished ? "—" : "…")}</span>
                    </p>
                  </div>
                </div>
              )}
            </Panel>

            {/* TIMELINE */}
            <Panel id="vessel" title="Container journey timeline">
              {!journey ? (
                <p className="text-sm text-muted-foreground">Aucun conteneur sélectionné.</p>
              ) : (
                <ol className="relative max-h-[420px] space-y-1 overflow-y-auto pl-6">
                  <span className="absolute left-[7px] top-2 h-[calc(100%-1rem)] w-px bg-border" />
                  {[...journey.events].reverse().map((m) => {
                    const late = m.duration > 45;
                    return (
                      <li key={m.id}>
                        <button onClick={() => setEvent(m)} className="group flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface/70">
                          <span className={`absolute left-0 mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-background ${late ? "bg-destructive" : "bg-primary"}`} />
                          <span className="w-28 shrink-0 text-xs tabular-nums text-muted-foreground">{fmtDate(m.time)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-foreground group-hover:text-primary">{m.event.replace(/_/g, " ")}</span>
                            <span className="block text-[11px] text-muted-foreground">{m.from} → {m.to} · {m.cheType} {m.che} · {m.duration} min</span>
                          </span>
                          {late && <span className="shrink-0 text-[10px] font-semibold text-destructive">⚠ DELAY</span>}
                        </button>
                      </li>
                    );
                  })}
                  {journey.pending.slice(0, 3).map((m) => (
                    <li key={m.id} className="flex items-start gap-3 px-2 py-2 opacity-45">
                      <span className="absolute left-0 mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-muted" />
                      <span className="w-28 shrink-0 text-xs tabular-nums text-muted-foreground">{fmtDate(m.time)}</span>
                      <span className="text-sm text-muted-foreground">{m.event.replace(/_/g, " ")} (prévu)</span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            {/* YARD + GATE */}
            <div className="grid gap-6 md:grid-cols-2">
              <Panel id="yard" title="Yard occupancy">
                <div className="space-y-2">
                  {blocks.slice(0, 10).map((b) => (
                    <div key={b.block} className="flex items-center gap-3">
                      <span className="w-10 text-xs font-semibold">{b.block}</span>
                      <div className="h-2 flex-1 rounded-full bg-surface-2">
                        <div className="h-2 rounded-full bg-info" style={{ width: `${Math.min(100, (b.slots.length / 42) * 100)}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{b.slots.length}</span>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title="Gate operations">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[["Trucks waiting", gate.waiting], ["Trucks processing", gate.processing], ["Trucks completed", gate.done], ["Average gate time", `${gate.avg} min`]].map(([k, v]) => (
                    <div key={k as string} className="rounded-lg border border-border/50 bg-surface/50 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
                      <p className="font-display mt-1 text-lg font-semibold tabular-nums">{v}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            {/* ANALYTICS: vessel calls */}
            <Panel id="analytics" title="Vessel calls en cours">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="border-b border-border/60 text-left">
                      {["Call", "Vessel", "Voyage", "Line", "Terminal", "ATA", "Berth", "ETD"].map((h) => <th key={h} className="py-2 pr-3 font-medium">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {activeCalls.map((v) => (
                      <tr key={v.callId} className="border-b border-border/30">
                        <td className="py-2 pr-3">{v.callId}</td>
                        <td className="py-2 pr-3 text-foreground">{v.vessel}</td>
                        <td className="py-2 pr-3">{v.voyage}</td>
                        <td className="py-2 pr-3">{v.line}</td>
                        <td className="py-2 pr-3">{v.terminal}</td>
                        <td className="py-2 pr-3 tabular-nums">{fmtDate(v.ata)}</td>
                        <td className="py-2 pr-3 tabular-nums">{fmtDate(v.berth)}</td>
                        <td className="py-2 pr-3 tabular-nums">{fmtDate(v.etd)}</td>
                      </tr>
                    ))}
                    {!activeCalls.length && <tr><td colSpan={8} className="py-4 text-muted-foreground">Aucune escale active à cet instant.</td></tr>}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            <Panel title={`Containers (${journeys.length})`}>
              <div className="max-h-[300px] space-y-1 overflow-y-auto pr-1">
                {journeys.slice(0, 200).map((j) => (
                  <button key={j.container.id} onClick={() => setSelected(j.container.id)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${selected === j.container.id ? "border-primary bg-primary/10" : "border-border/40 hover:border-primary/40"}`}>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${SEV_STYLE[j.severity].dot}`} />
                    <span className="font-medium text-foreground">{j.container.id}</span>
                    <span className="text-muted-foreground">{j.container.flow}</span>
                    <span className="ml-auto tabular-nums text-muted-foreground">{j.progress}%</span>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel id="equipment" title="Equipment (CHE)">
              <div className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
                {visibleEquipment.slice(0, 40).map((e) => (
                  <button key={e.id} onClick={() => setEquip(e)} className="w-full rounded-lg border border-border/40 p-2.5 text-left hover:border-primary/40">
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`h-2 w-2 rounded-full ${e.status === "WORKING" ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
                      <span className="font-semibold text-foreground">{e.id}</span>
                      <span className="text-muted-foreground">{e.type}</span>
                      <span className="ml-auto text-muted-foreground">{e.movesLastHour} moves/h</span>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      {e.status === "WORKING" ? `${e.task} · ${e.container} · ${e.from} → ${e.to}` : "IDLE — en attente d'affectation"}
                    </p>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel id="anomalies" title={<span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />Operational anomalies</span>}>
              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {anomalies.map((a, i) => <AnomalyCard key={a.containerId + a.kind + i} a={a} onSelect={() => setSelected(a.containerId)} />)}
                {!anomalies.length && <p className="text-xs text-muted-foreground">🟢 Aucune anomalie détectée sur le périmètre filtré.</p>}
              </div>
            </Panel>

            {journey && (journey.severity === "DELAY" || journey.severity === "CRITICAL") && (
              <Panel title="Why is this container blocked?">
                <div className="space-y-2 text-xs">
                  <p className="font-display text-base font-semibold text-destructive">CONTAINER BLOCKED · {journey.container.id}</p>
                  <p><span className="text-muted-foreground">Current location :</span> {journey.position}</p>
                  <p><span className="text-muted-foreground">Blocked because :</span> {journey.anomalies[0]?.message} — {journey.anomalies[0]?.equipment ?? "—"}</p>
                  <p><span className="text-muted-foreground">Waiting :</span> {journey.anomalies[0]?.minutes} minutes</p>
                  <p><span className="text-muted-foreground">Impact :</span> +{journey.anomalies[0]?.impactMin} min sur la livraison</p>
                  <p><span className="text-muted-foreground">Recommended action :</span> <span className="text-primary">{journey.anomalies[0]?.recommendation}</span></p>
                </div>
              </Panel>
            )}
          </div>
        </div>
      </main>

      {/* MODALS */}
      {event && (
        <Modal title={`Movement ${event.id}`} onClose={() => setEvent(null)}>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            {[
              ["Event type", event.event.replace(/_/g, " ")], ["Timestamp", fmtDate(event.time)],
              ["Movement ID", event.id], ["CHE", `${event.cheType} ${event.che}`],
              ["From position", event.from], ["To position", event.to],
              ["Duration", `${event.duration} min`], ["Status", event.status],
              ["Yard position", event.yard], ["Exception", event.reason || event.exception || "None"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border/50 bg-surface/50 p-2.5">
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</dt>
                <dd className="mt-1 text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}

      {equip && (
        <Modal title={`${equip.type} ${equip.id}`} onClose={() => setEquip(null)}>
          <div className="space-y-2 text-xs">
            <p><span className="text-muted-foreground">STATUS :</span> <span className={equip.status === "WORKING" ? "text-success" : "text-muted-foreground"}>{equip.status}</span></p>
            <p><span className="text-muted-foreground">CONTAINER :</span> {equip.container ?? "—"}</p>
            <p><span className="text-muted-foreground">TASK :</span> {equip.task ?? "—"}</p>
            <p><span className="text-muted-foreground">MOVEMENT :</span> {equip.movementId ?? "—"}</p>
            <p><span className="text-muted-foreground">ROUTE :</span> {equip.from ?? "—"} → {equip.to ?? "—"}</p>
            <p><span className="text-muted-foreground">PRODUCTIVITY :</span> {equip.movesLastHour} moves/hour</p>
            {equip.container && <Button size="sm" className="mt-2" onClick={() => { setSelected(equip.container!); setEquip(null); }}>Suivre ce conteneur</Button>}
          </div>
        </Modal>
      )}

      {report && journey && <ReportModal journey={journey} onClose={() => setReport(false)} />}
    </div>
  );
}

function AnomalyCard({ a, onSelect }: { a: Anomaly; onSelect: () => void }) {
  const s = SEV_STYLE[a.severity];
  return (
    <button onClick={onSelect} className="w-full rounded-xl border border-border/50 bg-surface/50 p-3 text-left hover:border-primary/50">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${s.dot}`} />
        <span className={`text-xs font-semibold ${s.text}`}>🚨 {a.message}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{fmtDate(a.time)}</span>
      </div>
      <p className="mt-1.5 text-[11px] text-foreground">{a.containerId} · {a.detail}</p>
      <p className="text-[11px] text-muted-foreground">
        {a.equipment ? `Equipment ${a.equipment} · ` : ""}{a.location ? `Location ${a.location} · ` : ""}Impact +{a.impactMin} min
      </p>
      <p className="mt-1 text-[11px] text-primary">→ {a.recommendation}</p>
    </button>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-surface-gradient p-5 shadow-elegant" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h4 className="font-display text-sm font-semibold uppercase tracking-[0.14em]">{title}</h4>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ReportModal({ journey, onClose }: { journey: Journey; onClose: () => void }) {
  const r = buildReport(journey);
  const blocked = journey.events.filter((m) => m.duration > 45);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <div id="reports" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border/60 bg-surface-gradient p-6 shadow-elegant" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h4 className="font-display text-lg font-semibold">Container report · {r.containerId}</h4>
            <p className="text-xs text-muted-foreground">Marsa Maroc Casablanca · {r.terminal} · généré depuis le tracking engine</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
          {[
            ["Flow", r.flow], ["Vessel", `${r.vessel} ${r.voyage}`], ["Terminal", r.terminal],
            ["Start time", fmtDate(r.startTime)], ["End time", fmtDate(r.endTime)],
            ["Total cycle time", `${Math.floor(r.cycleMin / 60)}h ${r.cycleMin % 60}m`],
            ["Current position", r.position], ["Movements", r.movements], ["Equipment used", r.equipment.join(", ") || "—"],
            ["Exceptions", r.exceptions], ["Total delay", `${r.totalDelay} min`], ["Final status", r.status],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-lg border border-border/50 bg-surface/50 p-3">
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</dt>
              <dd className="mt-1 text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
        <h5 className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">Operational performance</h5>
        <p className="mt-1 text-xs text-muted-foreground">
          Progression {r.progress}% · {r.movements} mouvements · productivité moyenne{" "}
          {r.cycleMin ? (r.movements / (r.cycleMin / 60)).toFixed(2) : "0"} moves/h · sévérité {SEV_STYLE[r.severity].label}.
        </p>
        <h5 className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-primary">Blockage analysis</h5>
        {blocked.length ? (
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            {blocked.map((m) => (
              <li key={m.id}>• {m.event.replace(/_/g, " ")} — {m.cheType} {m.che} — {m.duration} min ({blockOf(m.yard) || m.to})</li>
            ))}
          </ul>
        ) : <p className="mt-1 text-xs text-muted-foreground">Aucun blocage significatif détecté sur ce cycle.</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => window.print()}><FileText className="mr-1.5 h-3.5 w-3.5" />Exporter / imprimer</Button>
          <Button size="sm" onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </div>
  );
}

export { Ship, Gauge };
