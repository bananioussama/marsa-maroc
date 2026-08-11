import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Container, Ship, Timer, Layers, Snowflake, ShieldAlert, Wrench as Crane, X,
  ArrowLeftRight, Anchor, Search, Filter, Home, Repeat, Package, Brain,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, AreaChart, Area, RadialBarChart, RadialBar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import marsaLogo from "@/assets/marsa-maroc-logo.png.asset.json";

export const Route = createFileRoute("/conteneurs")({
  component: ContainersDashboard,
  head: () => ({
    meta: [
      { title: "Conteneurs Marsa Maroc — Tableau de bord terminal" },
      { name: "description", content: "Pilotage du terminal à conteneurs : TEU, dwell time, productivité des grues, rehandles, reefers, holds douane et trafic navires." },
      { property: "og:title", content: "Conteneurs Marsa Maroc — Tableau de bord terminal" },
      { property: "og:description", content: "KPI terminal à conteneurs : TEU, dwell time, productivité grues, holds et trafic navires." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Encoded = { keys: string[]; dicts: Record<string, string[]>; rows: (string | number)[][] };
type Payload = { units: Encoded; moves: Encoded };

type Unit = {
  id: string; iso: string; categorie: string; vstate: string; tstate: string;
  position: string; armateur: string; pod: string; frght: string; reefer: string;
  timeIn: string; timeOut: string; cycle: number; mr: string; restow: string; hold: string;
};

type Move = {
  id: string; time: string; event: string; kind: string; iso: string; frght: string;
  crane: string; from: string; to: string; navire: string; armateur: string;
  dwell: number; rehandle: number; poids: number; hazard: string; oog: string;
  reefer: string; pod: string; pol: string; dest: string; berth: string;
};

const NUM_KEYS = new Set(["cycle", "dwell", "rehandle", "poids"]);
const RAW_KEYS = new Set(["id", "timeIn", "timeOut", "time"]);

function decode<T>(enc: Encoded): T[] {
  return enc.rows.map((r) => {
    const o: Record<string, unknown> = {};
    enc.keys.forEach((k, i) => {
      const v = r[i];
      o[k] = NUM_KEYS.has(k) || RAW_KEYS.has(k) ? v : enc.dicts[k]?.[v as number] ?? "";
    });
    return o as T;
  });
}

const CHART_COLORS = [
  "var(--color-chart-2)", "var(--color-chart-6)", "var(--color-chart-1)",
  "var(--color-chart-3)", "var(--color-chart-5)", "var(--color-chart-4)",
];

const CAT_COLOR: Record<string, string> = {
  Import: "var(--color-info)",
  Export: "var(--color-chart-1)",
  Storage: "var(--color-chart-6)",
  Transshipment: "var(--color-chart-3)",
};

const teuOf = (iso: string) => (iso.startsWith("22") ? 1 : 2);

const tooltipStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
  boxShadow: "var(--shadow-elegant)",
  color: "var(--color-foreground)",
  fontSize: "12px",
} as const;
const tooltipLabel = { color: "var(--color-foreground)", fontWeight: 600 } as const;
const tooltipItem = { color: "var(--color-muted-foreground)" } as const;

function countBy<T>(arr: T[], get: (x: T) => string) {
  const m = new Map<string, number>();
  for (const x of arr) { const k = get(x); m.set(k, (m.get(k) ?? 0) + 1); }
  return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function meanBy<T>(arr: T[], get: (x: T) => string, val: (x: T) => number) {
  const m = new Map<string, { s: number; n: number }>();
  for (const x of arr) {
    const k = get(x); const c = m.get(k) ?? { s: 0, n: 0 };
    c.s += val(x); c.n += 1; m.set(k, c);
  }
  return Array.from(m, ([name, { s, n }]) => ({ name, value: Math.round((s / n) * 10) / 10 }));
}

function Kpi({ icon: Icon, label, value, sub, tone = "primary" }: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  tone?: "primary" | "success" | "info" | "warning" | "destructive";
}) {
  const toneMap = {
    primary: "text-primary bg-primary/10 ring-primary/20",
    success: "text-success bg-success/10 ring-success/20",
    info: "text-info bg-info/10 ring-info/20",
    warning: "text-warning bg-warning/10 ring-warning/20",
    destructive: "text-destructive bg-destructive/10 ring-destructive/20",
  };
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-surface-gradient p-5 shadow-elegant transition-all hover:-translate-y-0.5 hover:border-primary/40">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="font-display mt-2.5 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
          {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={`rounded-xl p-2.5 ring-1 ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children, className = "" }: {
  title: React.ReactNode; subtitle?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <Card className={`border-border/60 bg-surface-gradient shadow-elegant ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle className="font-display text-base font-semibold">{title}</CardTitle>
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

type Filters = {
  armateur: string; categorie: string; iso: string; position: string;
  pod: string; frght: string; hold: string; event: string;
};

const EMPTY: Filters = {
  armateur: "", categorie: "", iso: "", position: "", pod: "", frght: "", hold: "", event: "",
};

function ContainersDashboard() {
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [f, setF] = useState<Filters>(EMPTY);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch("/data/containers.json")
      .then((r) => r.json())
      .then((d: Payload) => {
        setUnits(decode<Unit>(d.units));
        setMoves(decode<Move>(d.moves));
      })
      .catch(() => setUnits([]));
  }, []);

  const toggle = (k: keyof Filters, v: string) =>
    setF((p) => ({ ...p, [k]: p[k] === v ? "" : v }));

  useEffect(() => setPage(0), [f, q]);

  const fUnits = useMemo(() => {
    if (!units) return [];
    const s = q.trim().toLowerCase();
    return units.filter((u) =>
      (!f.armateur || u.armateur === f.armateur) &&
      (!f.categorie || u.categorie === f.categorie) &&
      (!f.iso || u.iso === f.iso) &&
      (!f.position || u.position === f.position) &&
      (!f.pod || u.pod === f.pod) &&
      (!f.frght || u.frght === f.frght) &&
      (!f.hold || u.hold === f.hold) &&
      (!s || u.id.toLowerCase().includes(s))
    );
  }, [units, f, q]);

  const fMoves = useMemo(() => {
    const ids = new Set(fUnits.map((u) => u.id));
    const activeUnitFilter = f.armateur || f.categorie || f.iso || f.position || f.pod || f.frght || f.hold || q.trim();
    return moves.filter((m) =>
      (!f.event || m.event === f.event) &&
      (!activeUnitFilter || ids.has(m.id) || m.armateur === f.armateur)
    );
  }, [moves, fUnits, f, q]);

  const opts = useMemo(() => {
    const u = units ?? [];
    const uniq = (get: (x: Unit) => string) => Array.from(new Set(u.map(get))).sort();
    return {
      armateur: uniq((x) => x.armateur),
      categorie: uniq((x) => x.categorie),
      iso: uniq((x) => x.iso),
      position: uniq((x) => x.position),
      pod: uniq((x) => x.pod),
      hold: uniq((x) => x.hold),
      event: Array.from(new Set(moves.map((m) => m.event))).sort(),
    };
  }, [units, moves]);

  const kpi = useMemo(() => {
    const teu = fUnits.reduce((s, u) => s + teuOf(u.iso), 0);
    const inYard = fUnits.filter((u) => u.vstate === "Active" || u.tstate === "In Yard").length;
    const reefers = fUnits.filter((u) => u.reefer === "true").length;
    const holds = fUnits.filter((u) => u.hold !== "None").length;
    const full = fUnits.filter((u) => u.frght === "Full").length;
    const dwellMap = new Map<string, number>();
    for (const m of fMoves) if (!dwellMap.has(m.id)) dwellMap.set(m.id, m.dwell);
    const dwellVals = Array.from(dwellMap.values());
    const dwell = dwellVals.length ? dwellVals.reduce((a, b) => a + b, 0) / dwellVals.length : 0;
    const rehandles = fMoves.reduce((s, m) => s + m.rehandle, 0);
    const restows = fUnits.filter((u) => u.restow === "Yes").length;
    const qcMoves = fMoves.filter((m) => m.crane.startsWith("QC"));
    const craneHours = new Set(qcMoves.map((m) => `${m.crane}|${m.time.slice(0, 13)}`)).size || 1;
    return {
      teu, inYard, reefers, holds, full,
      dwell: dwell / 24,
      rehandleRate: fMoves.length ? (rehandles / fMoves.length) * 100 : 0,
      restowRate: fUnits.length ? (restows / fUnits.length) * 100 : 0,
      gmph: qcMoves.length / craneHours,
      moves: fMoves.length,
      mr: fUnits.filter((u) => u.mr !== "Clear").length,
    };
  }, [fUnits, fMoves]);

  const byCat = useMemo(() => countBy(fUnits, (u) => u.categorie), [fUnits]);
  const byIso = useMemo(() => countBy(fUnits, (u) => u.iso), [fUnits]);
  const byArmateur = useMemo(() => countBy(fUnits, (u) => u.armateur), [fUnits]);
  const byPos = useMemo(
    () => countBy(fUnits, (u) => u.position).sort((a, b) => a.name.localeCompare(b.name)),
    [fUnits]
  );
  const byPod = useMemo(() => countBy(fUnits, (u) => u.pod), [fUnits]);
  const byHold = useMemo(() => countBy(fUnits.filter((u) => u.hold !== "None"), (u) => u.hold), [fUnits]);
  const byMr = useMemo(() => countBy(fUnits, (u) => u.mr), [fUnits]);
  const byTstate = useMemo(() => countBy(fUnits, (u) => u.tstate), [fUnits]);

  const byEvent = useMemo(() => countBy(fMoves, (m) => m.event), [fMoves]);
  const byCrane = useMemo(
    () => countBy(fMoves.filter((m) => m.crane), (m) => m.crane).sort((a, b) => a.name.localeCompare(b.name)),
    [fMoves]
  );
  const byBerth = useMemo(
    () => countBy(fMoves, (m) => m.berth).sort((a, b) => a.name.localeCompare(b.name)),
    [fMoves]
  );
  const byNavire = useMemo(() => countBy(fMoves, (m) => m.navire).slice(0, 10), [fMoves]);
  const byHour = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, h) => ({ name: `${String(h).padStart(2, "0")}h`, value: 0 }));
    for (const m of fMoves) {
      const h = Number(m.time.slice(11, 13));
      if (!Number.isNaN(h) && arr[h]) arr[h].value += 1;
    }
    return arr;
  }, [fMoves]);

  const daily = useMemo(() => {
    const m = new Map<string, number>();
    for (const mv of fMoves) {
      const d = mv.time.slice(0, 10);
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => a.name.localeCompare(b.name));
  }, [fMoves]);

  const dwellByArmateur = useMemo(() => {
    const seen = new Set<string>();
    const rows = fMoves.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
    return meanBy(rows, (m) => m.armateur, (m) => m.dwell / 24)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [fMoves]);

  const dwellByCat = useMemo(
    () => meanBy(fUnits, (u) => u.categorie, (u) => u.cycle).sort((a, b) => b.value - a.value),
    [fUnits]
  );

  const activeChips = (Object.entries(f) as [keyof Filters, string][]).filter(([, v]) => v);
  const rows = fUnits.slice(page * 12, page * 12 + 12);
  const pages = Math.ceil(fUnits.length / 12);

  if (!units) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background bg-hero">
        <div className="flex flex-col items-center gap-4">
          <Container className="h-10 w-10 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">Chargement du terminal à conteneurs…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-hero">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-elegant ring-1 ring-border/60">
              <img src={marsaLogo.url} alt="Logo Marsa Maroc" className="h-full w-full object-contain" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold leading-none">
                Marsa Maroc <span className="text-primary">·</span> Conteneurs
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Terminal à conteneurs · Yard, quai & opérations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden border-success/40 bg-success/10 text-success md:inline-flex">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
              Temps réel
            </Badge>
            <Button asChild className="h-9 gap-2">
              <Link to="/assistant"><Brain className="h-4 w-4" />Marsa IA</Link>
            </Button>
            <Button asChild variant="outline" className="h-9 gap-2">
              <Link to="/"><Home className="h-4 w-4" />Accueil</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] space-y-6 px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              Performance <span className="text-gradient-primary">du terminal</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {units.length.toLocaleString("fr-FR")} conteneurs · {moves.length.toLocaleString("fr-FR")} mouvements.
              Cliquez sur un secteur ou une barre pour filtrer tout le tableau de bord.
            </p>
          </div>
        </div>

        {/* Filtres */}
        <Card className="border-border/60 bg-surface-gradient shadow-elegant">
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[300px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Rechercher un conteneur…"
                  className="h-11 pl-9"
                />
              </div>
              {([
                ["armateur", "Armateur", opts.armateur],
                ["categorie", "Catégorie", opts.categorie],
                ["iso", "Type ISO", opts.iso],
                ["position", "Bloc", opts.position],
                ["pod", "POD", opts.pod],
                ["hold", "Hold", opts.hold],
                ["event", "Mouvement", opts.event],
              ] as [keyof Filters, string, string[]][]).map(([key, label, values]) => (
                <Select
                  key={key}
                  value={f[key] || "all"}
                  onValueChange={(v) => setF((p) => ({ ...p, [key]: v === "all" ? "" : v }))}
                >
                  <SelectTrigger className="h-11 w-[190px] [&>span]:truncate">
                    <SelectValue placeholder={label} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{label} — tous</SelectItem>
                    {values.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}
              <Button
                variant="ghost"
                className="h-10 gap-2 text-muted-foreground"
                onClick={() => { setF(EMPTY); setQ(""); }}
              >
                <Filter className="h-4 w-4" />Réinitialiser
              </Button>
            </div>
            {activeChips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {activeChips.map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => setF((p) => ({ ...p, [k]: "" }))}
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary transition-colors hover:bg-primary/20"
                  >
                    {v}<X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={Container} label="Conteneurs" value={fUnits.length.toLocaleString("fr-FR")} sub={`${kpi.full.toLocaleString("fr-FR")} pleins · ${(fUnits.length - kpi.full).toLocaleString("fr-FR")} vides`} />
          <Kpi icon={Layers} label="Volume TEU" value={kpi.teu.toLocaleString("fr-FR")} sub="Équivalent vingt pieds" tone="info" />
          <Kpi icon={Timer} label="Dwell time moyen" value={`${kpi.dwell.toFixed(1)} j`} sub="Séjour moyen sur le parc" tone="warning" />
          <Kpi icon={Crane} label="Productivité quai" value={`${kpi.gmph.toFixed(1)} GMPH`} sub="Mouvements grue / heure" tone="success" />
          <Kpi icon={Ship} label="Mouvements" value={kpi.moves.toLocaleString("fr-FR")} sub={`${byEvent[0]?.name ?? "—"} en tête`} tone="info" />
          <Kpi icon={Snowflake} label="Reefers" value={kpi.reefers.toLocaleString("fr-FR")} sub="Conteneurs sous énergie" tone="info" />
          <Kpi icon={ShieldAlert} label="Holds actifs" value={kpi.holds.toLocaleString("fr-FR")} sub="Douane, ligne, documentation" tone="destructive" />
          <Kpi icon={Repeat} label="Taux de rehandle" value={`${kpi.rehandleRate.toFixed(1)} %`} sub={`Restow ${kpi.restowRate.toFixed(1)} %`} tone="warning" />
        </div>

        {/* Flux quotidien */}
        <Panel title="Flux quotidien des mouvements" subtitle="Tous types confondus">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={daily}>
              <defs>
                <linearGradient id="cflux" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} minTickGap={24} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
              <Area type="monotone" dataKey="value" name="Mouvements" stroke="var(--color-chart-2)" strokeWidth={2} fill="url(#cflux)" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Répartition par catégorie" subtitle="Cliquez pour filtrer">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={byCat} dataKey="value" nameKey="name" innerRadius={65} outerRadius={100} paddingAngle={3}
                  onClick={(d: { name?: string }) => d?.name && toggle("categorie", d.name)}
                >
                  {byCat.map((d) => (
                    <Cell key={d.name} cursor="pointer" fill={CAT_COLOR[d.name] ?? "var(--color-chart-2)"} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Statut transport (T-State)" subtitle="Vue opérationnelle">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={byTstate} dataKey="value" nameKey="name" innerRadius={65} outerRadius={100} paddingAngle={3}>
                  {byTstate.map((d, i) => (
                    <Cell key={d.name} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Productivité par engin" subtitle="Grues de quai (QC) & portiques (RTG)">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byCrane}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip cursor={{ fill: "var(--color-muted)", opacity: 0.15 }} contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
                <Bar dataKey="value" name="Mouvements" radius={[6, 6, 0, 0]}>
                  {byCrane.map((d) => (
                    <Cell key={d.name} fill={d.name.startsWith("QC") ? "var(--color-chart-1)" : "var(--color-chart-6)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Occupation du parc par bloc" subtitle="Cliquez pour filtrer">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byPos} onClick={(s: { activeLabel?: string }) => s?.activeLabel && toggle("position", s.activeLabel)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip cursor={{ fill: "var(--color-muted)", opacity: 0.15 }} contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
                <Bar dataKey="value" name="Conteneurs" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Top armateurs" subtitle="Cliquez pour filtrer">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byArmateur} layout="vertical" onClick={(s: { activeLabel?: string }) => s?.activeLabel && toggle("armateur", s.activeLabel)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip cursor={{ fill: "var(--color-muted)", opacity: 0.15 }} contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
                <Bar dataKey="value" name="Conteneurs" fill="var(--color-chart-6)" radius={[0, 6, 6, 0]} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Dwell time moyen par armateur" subtitle="En jours">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dwellByArmateur} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
                <Bar dataKey="value" name="Jours" fill="var(--color-chart-1)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Types ISO du parc" subtitle="Cliquez pour filtrer">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byIso} onClick={(s: { activeLabel?: string }) => s?.activeLabel && toggle("iso", s.activeLabel)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip cursor={{ fill: "var(--color-muted)", opacity: 0.15 }} contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
                <Bar dataKey="value" name="Conteneurs" fill="var(--color-chart-3)" radius={[6, 6, 0, 0]} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Ports de destination (POD)" subtitle="Cliquez pour filtrer">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byPod} onClick={(s: { activeLabel?: string }) => s?.activeLabel && toggle("pod", s.activeLabel)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} interval={0} angle={-20} height={50} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip cursor={{ fill: "var(--color-muted)", opacity: 0.15 }} contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
                <Bar dataKey="value" name="Conteneurs" fill="var(--color-chart-5)" radius={[6, 6, 0, 0]} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Nature des mouvements" subtitle="Cliquez pour filtrer">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={byEvent} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={3}
                  onClick={(d: { name?: string }) => d?.name && toggle("event", d.name)}
                >
                  {byEvent.map((d, i) => (
                    <Cell key={d.name} cursor="pointer" fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Activité par poste à quai" subtitle="Mouvements par berth">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byBerth}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip cursor={{ fill: "var(--color-muted)", opacity: 0.15 }} contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
                <Bar dataKey="value" name="Mouvements" fill="var(--color-chart-4)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Top navires" subtitle="Escales les plus actives">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={byNavire} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
                <Bar dataKey="value" name="Mouvements" fill="var(--color-chart-2)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Charge horaire du terminal" subtitle="Mouvements par heure de la journée">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={byHour}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} interval={1} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip cursor={{ fill: "var(--color-muted)", opacity: 0.15 }} contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
                <Bar dataKey="value" name="Mouvements" fill="var(--color-chart-6)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Motifs de blocage (Hold)" subtitle="Cliquez pour filtrer">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={byHold} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={3}
                  onClick={(d: { name?: string }) => d?.name && toggle("hold", d.name)}
                >
                  {byHold.map((d, i) => (
                    <Cell key={d.name} cursor="pointer" fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="État M&R du parc" subtitle="Maintenance & réparation">
            <ResponsiveContainer width="100%" height={280}>
              <RadialBarChart data={byMr.map((d, i) => ({ ...d, fill: CHART_COLORS[i % CHART_COLORS.length] }))} innerRadius="30%" outerRadius="100%" startAngle={90} endAngle={-270}>
                <RadialBar dataKey="value" background cornerRadius={8} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              </RadialBarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Temps de cycle déchargement" subtitle="Moyenne par catégorie (heures)">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dwellByCat} onClick={(s: { activeLabel?: string }) => s?.activeLabel && toggle("categorie", s.activeLabel)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip cursor={{ fill: "var(--color-muted)", opacity: 0.15 }} contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
                <Bar dataKey="value" name="Heures" radius={[6, 6, 0, 0]} cursor="pointer">
                  {dwellByCat.map((d) => (
                    <Cell key={d.name} fill={CAT_COLOR[d.name] ?? "var(--color-chart-2)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        {/* Table */}
        <Panel
          title={<span className="flex items-center gap-2"><Package className="h-4 w-4 text-primary" />Détail des conteneurs</span>}
          subtitle={`${fUnits.length.toLocaleString("fr-FR")} résultats`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  {["Conteneur", "ISO", "Catégorie", "Armateur", "Bloc", "POD", "Charge", "Statut", "Hold"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-b border-border/40 transition-colors hover:bg-muted/30">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-foreground">{u.id}</td>
                    <td className="px-3 py-2 text-muted-foreground">{u.iso}</td>
                    <td className="px-3 py-2">{u.categorie}</td>
                    <td className="px-3 py-2 text-muted-foreground">{u.armateur}</td>
                    <td className="px-3 py-2 text-muted-foreground">{u.position}</td>
                    <td className="px-3 py-2 text-muted-foreground">{u.pod}</td>
                    <td className="px-3 py-2">{u.frght}</td>
                    <td className="px-3 py-2">{u.tstate}</td>
                    <td className="px-3 py-2">
                      {u.hold === "None" ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">{u.hold}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">Page {page + 1} / {Math.max(pages, 1)}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
              <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
            </div>
          </div>
        </Panel>

        <footer className="flex items-center justify-center gap-2 pb-6 pt-2 text-xs text-muted-foreground">
          <Anchor className="h-3.5 w-3.5" />
          Marsa Maroc · Département Conteneurs
          <ArrowLeftRight className="h-3.5 w-3.5" />
          <Link to="/voiturerie" className="text-primary hover:underline">Voir le département Voiturerie</Link>
        </footer>
      </main>
    </div>
  );
}
