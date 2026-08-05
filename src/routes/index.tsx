import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Ship, Car, PackageCheck, Warehouse, Clock, TrendingUp, Filter, Search,
  Anchor, X, ShieldAlert, Wrench, MapPin, Factory, Download, Brain,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, AreaChart, Area, LineChart, Line,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getProjectSourceFiles } from "@/lib/download-project.functions";
import JSZip from "jszip";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Voiturier Marsa Maroc — Tableau de bord opérationnel" },
      { name: "description", content: "Pilotage temps réel du parc véhicules importés à Tanger Med : stock, inspections, zones, flux navires et livraisons." },
      { property: "og:title", content: "Voiturier Marsa Maroc — Tableau de bord" },
      { property: "og:description", content: "Pilotage temps réel du parc véhicules importés." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Raw = {
  cols: string[];
  dicts: Record<string, string[]>;
  rows: (string | number)[][];
};

type Vehicle = {
  id: string; marque: string; modele: string; annee: number; couleur: string;
  type: string; carburant: string; transmission: string; importateur: string;
  pays: string; port: string; navire: string; zone: string; statut: string;
  etat: string; destination: string; mois: string; duree: number;
};

const CHART_COLORS = [
  "var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)",
  "var(--color-chart-4)", "var(--color-chart-5)", "var(--color-chart-6)",
];

const STATUT_COLOR: Record<string, string> = {
  "En Stock": "var(--color-info)",
  "Sorti": "var(--color-success)",
  "En Inspection": "var(--color-warning)",
  "Bloqué": "var(--color-destructive)",
};

function decode(raw: Raw): Vehicle[] {
  const { dicts, rows } = raw;
  return rows.map((r) => ({
    id: r[0] as string,
    marque: dicts.Marque[r[1] as number],
    modele: dicts.Modele[r[2] as number],
    annee: r[3] as number,
    couleur: dicts.Couleur[r[4] as number],
    type: dicts.Type[r[5] as number],
    carburant: dicts.Carburant[r[6] as number],
    transmission: dicts.Transmission[r[7] as number],
    importateur: dicts.Importateur[r[8] as number],
    pays: dicts.Pays_Origine[r[9] as number],
    port: dicts.Port_Origine[r[10] as number],
    navire: dicts.Navire[r[11] as number],
    zone: dicts.Zone_Stockage[r[12] as number],
    statut: dicts.Statut[r[13] as number],
    etat: dicts.Etat[r[14] as number],
    destination: dicts.Destination[r[15] as number],
    mois: dicts.MoisArrivee[r[16] as number],
    duree: r[17] as number,
  }));
}

const groupCount = (arr: Vehicle[], key: keyof Vehicle) => {
  const m = new Map<string, number>();
  for (const v of arr) m.set(String(v[key]), (m.get(String(v[key])) ?? 0) + 1);
  return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};

const groupMean = (arr: Vehicle[], key: keyof Vehicle, valKey: keyof Vehicle) => {
  const m = new Map<string, { s: number; n: number }>();
  for (const v of arr) {
    const k = String(v[key]);
    const cur = m.get(k) ?? { s: 0, n: 0 };
    cur.s += Number(v[valKey]); cur.n += 1;
    m.set(k, cur);
  }
  return Array.from(m, ([name, { s, n }]) => ({ name, value: Math.round((s / n) * 10) / 10 }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

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
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-surface-gradient p-6 shadow-elegant transition-all hover:-translate-y-0.5 hover:border-primary/40">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:opacity-100" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="font-display mt-3 text-4xl font-semibold tabular-nums text-foreground">{value}</p>
          {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={`rounded-xl p-3 ring-1 ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children, className = "", hint }: {
  title: React.ReactNode; subtitle?: string; children: React.ReactNode; className?: string; hint?: string;
}) {
  return (
    <Card className={`border-border/60 bg-surface-gradient shadow-elegant ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle className="font-display text-base font-semibold">{title}</CardTitle>
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
        {hint && <p className="text-[11px] text-muted-foreground/80">{hint}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const tooltipStyle = {
  backgroundColor: "oklch(0.22 0.035 260)",
  border: "1px solid oklch(0.32 0.03 260)",
  borderRadius: 12,
  color: "oklch(0.97 0.01 250)",
  fontSize: 12,
  boxShadow: "0 10px 30px -12px oklch(0.1 0.02 260 / 0.6)",
};

type Filters = {
  q: string; marque: string; modele: string; statut: string; etat: string;
  zone: string; destination: string; pays: string; navire: string;
  annee: string; carburant: string; type: string; importateur: string; couleur: string;
};
const EMPTY: Filters = {
  q: "", marque: "all", modele: "all", statut: "all", etat: "all",
  zone: "all", destination: "all", pays: "all", navire: "all",
  annee: "all", carburant: "all", type: "all", importateur: "all", couleur: "all",
};

function FilterSelect({ label, value, onValueChange, options }: {
  label: string; value: string; onValueChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="min-w-[130px]">
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-9 border-border/60 bg-surface-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous</SelectItem>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function Dashboard() {
  const [all, setAll] = useState<Vehicle[] | null>(null);
  const [dicts, setDicts] = useState<Raw["dicts"] | null>(null);
  const [f, setF] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const fetchSourceFiles = useServerFn(getProjectSourceFiles);

  useEffect(() => {
    fetch("/data/vehicles.json").then((r) => r.json()).then((raw: Raw) => {
      setAll(decode(raw));
      setDicts(raw.dicts);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!all) return [];
    const q = f.q.trim().toLowerCase();
    return all.filter((v) =>
      (f.marque === "all" || v.marque === f.marque) &&
      (f.modele === "all" || v.modele === f.modele) &&
      (f.statut === "all" || v.statut === f.statut) &&
      (f.etat === "all" || v.etat === f.etat) &&
      (f.zone === "all" || v.zone === f.zone) &&
      (f.destination === "all" || v.destination === f.destination) &&
      (f.pays === "all" || v.pays === f.pays) &&
      (f.navire === "all" || v.navire === f.navire) &&
      (f.annee === "all" || String(v.annee) === f.annee) &&
      (f.carburant === "all" || v.carburant === f.carburant) &&
      (f.type === "all" || v.type === f.type) &&
      (f.importateur === "all" || v.importateur === f.importateur) &&
      (f.couleur === "all" || v.couleur === f.couleur) &&
      (!q || v.id.toLowerCase().includes(q) || v.modele.toLowerCase().includes(q) || v.marque.toLowerCase().includes(q))
    );
  }, [all, f]);

  useEffect(() => { setPage(1); }, [f]);

  // Toggle: click a chart segment → set filter to that value, click again → clear
  const toggle = (key: keyof Filters, value: string) => {
    setF((prev) => ({ ...prev, [key]: prev[key] === value ? "all" : value }));
  };

  const handleDownloadProject = async () => {
    try {
      setDownloading(true);
      const { files, included, errors } = await fetchSourceFiles();
      const zip = new JSZip();

      // Source files
      for (const [path, content] of Object.entries(files)) {
        zip.file(path, content);
      }

      // Data file
      try {
        const dataRes = await fetch("/data/vehicles.json");
        if (dataRes.ok) {
          const dataBlob = await dataRes.blob();
          zip.file("public/data/vehicles.json", dataBlob);
        }
      } catch {
        // data file optional
      }

      // README guide
      const readme = `# Marsa Maroc — Voiturier Dashboard

Archive générée depuis le tableau de bord Lovable.

## Fichiers inclus
- ${included.join("\n- ")}
- public/data/vehicles.json (données compressées du parc)

## Prérequis
- Node.js 20+
- Bun ou npm

## Lancer le projet
\`\`\`bash
bun install
bun run dev
# ou
npm install
npm run dev
\`\`\`

## Note
Pour exporter le projet complet à tout moment :
1. Dans Lovable, ouvre Project Settings (icône ⚙️ en haut à droite).
2. Va dans l’onglet GitHub et connecte ton compte.
3. Crée le repository — tout le code sera poussé automatiquement.
4. Sur ton ordinateur : \`git clone <url-du-repo>\`.

---
Généré le : ${new Date().toLocaleString("fr-FR")}
`;
      zip.file("README-DOWNLOAD.md", readme);

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `marsa-maroc-dashboard-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (errors.length) {
        console.warn("Fichiers non inclus :", errors);
      }
    } finally {
      setDownloading(false);
    }
  };

  const kpis = useMemo(() => {
    const total = filtered.length;
    const enStock = filtered.filter((v) => v.statut === "En Stock").length;
    const sortis = filtered.filter((v) => v.statut === "Sorti").length;
    const inspect = filtered.filter((v) => v.statut === "En Inspection").length;
    const bloques = filtered.filter((v) => v.statut === "Bloqué").length;
    const avg = total ? filtered.reduce((s, v) => s + v.duree, 0) / total : 0;
    return {
      total, enStock, sortis, inspect, bloques,
      avg: Math.round(avg * 10) / 10,
    };
  }, [filtered]);

  const byMois = useMemo(() => {
    const m = new Map<string, { arr: number; sortis: number }>();
    for (const v of filtered) {
      const cur = m.get(v.mois) ?? { arr: 0, sortis: 0 };
      cur.arr += 1;
      if (v.statut === "Sorti") cur.sortis += 1;
      m.set(v.mois, cur);
    }
    return Array.from(m, ([name, { arr, sortis }]) => ({ name, arr, sortis }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const activeCount = Object.entries(f).filter(([k, v]) => k !== "q" && v !== "all").length + (f.q ? 1 : 0);

  if (!all || !dicts) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background bg-hero">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Anchor className="h-5 w-5 animate-pulse text-primary" />
          <span>Chargement du parc véhicules…</span>
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / 20));
  const pageRows = filtered.slice((page - 1) * 20, page * 20);

  const statutData = groupCount(filtered, "statut");
  const carburantData = groupCount(filtered, "carburant");
  const typeData = groupCount(filtered, "type");
  const etatData = groupCount(filtered, "etat");
  const modelData = groupCount(filtered, "modele").slice(0, 10);
  const zoneData = groupCount(filtered, "zone").sort((a, b) => a.name.localeCompare(b.name));
  const paysData = groupCount(filtered, "pays");
  const destData = groupCount(filtered, "destination");
  const importData = groupCount(filtered, "importateur");
  const navireData = groupCount(filtered, "navire");
  const anneeData = groupCount(filtered, "annee").sort((a, b) => Number(a.name) - Number(b.name));

  const statutBadge = (s: string) => {
    const map: Record<string, string> = {
      "En Stock": "bg-info/15 text-info ring-info/30",
      "Sorti": "bg-success/15 text-success ring-success/30",
      "En Inspection": "bg-warning/15 text-warning ring-warning/30",
      "Bloqué": "bg-destructive/15 text-destructive ring-destructive/30",
    };
    return <Badge className={`${map[s]} ring-1 font-normal hover:opacity-90`}>{s}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background bg-hero">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative rounded-xl bg-gradient-to-br from-primary to-primary/70 p-2.5 shadow-glow">
              <Ship className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold leading-none">
                Marsa Maroc <span className="text-primary">·</span> Voiturier
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">Tableau de bord opérationnel · Terminal Tanger Med</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
              Système actif
            </Badge>
            <span className="text-xs text-muted-foreground">
              {all.length.toLocaleString("fr-FR")} véhicules suivis
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] space-y-6 px-6 py-8">
        {/* Hero */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              Vue d'ensemble <span className="text-gradient-primary">du parc</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cliquez sur n'importe quelle barre, secteur ou point du graphique pour filtrer instantanément le tableau de bord.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              asChild
              className="h-10 gap-2 bg-primary text-primary-foreground shadow-glow hover:bg-primary/90"
            >
              <Link to="/assistant">
                <Brain className="h-4 w-4" />
                Agent IA prédictif
              </Link>
            </Button>
            <Button
              onClick={handleDownloadProject}
              disabled={downloading}
              variant="outline"
              className="h-10 gap-2"
            >
              {downloading ? (
                <Anchor className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {downloading ? "Préparation…" : "Télécharger le projet"}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-border/60 bg-surface-gradient shadow-elegant">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Filter className="h-4 w-4 text-primary" />
                Filtres croisés
                {activeCount > 0 && <Badge className="bg-primary text-primary-foreground">{activeCount} actif{activeCount > 1 ? "s" : ""}</Badge>}
              </div>
              {activeCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setF(EMPTY)} className="h-8 text-xs">
                  <X className="mr-1 h-3 w-3" /> Réinitialiser
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-7">
              <div className="col-span-2">
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recherche</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={f.q}
                    onChange={(e) => setF({ ...f, q: e.target.value })}
                    placeholder="ID, marque, modèle…"
                    className="h-9 border-border/60 bg-surface-2 pl-9"
                  />
                </div>
              </div>
              <FilterSelect label="Marque" value={f.marque} onValueChange={(v) => setF({ ...f, marque: v })} options={dicts.Marque} />
              <FilterSelect label="Modèle" value={f.modele} onValueChange={(v) => setF({ ...f, modele: v })} options={dicts.Modele} />
              <FilterSelect label="Statut" value={f.statut} onValueChange={(v) => setF({ ...f, statut: v })} options={dicts.Statut} />
              <FilterSelect label="État" value={f.etat} onValueChange={(v) => setF({ ...f, etat: v })} options={dicts.Etat} />
              <FilterSelect label="Zone" value={f.zone} onValueChange={(v) => setF({ ...f, zone: v })} options={dicts.Zone_Stockage} />
              <FilterSelect label="Destination" value={f.destination} onValueChange={(v) => setF({ ...f, destination: v })} options={dicts.Destination} />
              <FilterSelect label="Pays" value={f.pays} onValueChange={(v) => setF({ ...f, pays: v })} options={dicts.Pays_Origine} />
              <FilterSelect label="Navire" value={f.navire} onValueChange={(v) => setF({ ...f, navire: v })} options={dicts.Navire} />
              <FilterSelect label="Carburant" value={f.carburant} onValueChange={(v) => setF({ ...f, carburant: v })} options={dicts.Carburant} />
              <FilterSelect label="Type" value={f.type} onValueChange={(v) => setF({ ...f, type: v })} options={dicts.Type} />
              <FilterSelect label="Importateur" value={f.importateur} onValueChange={(v) => setF({ ...f, importateur: v })} options={dicts.Importateur} />
              <FilterSelect label="Année" value={f.annee} onValueChange={(v) => setF({ ...f, annee: v })} options={Array.from(new Set(all.map((v) => String(v.annee)))).sort()} />
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Kpi icon={Car} label="Véhicules" value={kpis.total.toLocaleString("fr-FR")} sub={`/${all.length.toLocaleString("fr-FR")} au total`} />
          <Kpi icon={Warehouse} label="En stock" value={kpis.enStock.toLocaleString("fr-FR")}
               sub={`${kpis.total ? Math.round((kpis.enStock / kpis.total) * 100) : 0}%`} tone="info" />
          <Kpi icon={Wrench} label="En inspection" value={kpis.inspect.toLocaleString("fr-FR")}
               sub={`${kpis.total ? Math.round((kpis.inspect / kpis.total) * 100) : 0}%`} tone="warning" />
          <Kpi icon={PackageCheck} label="Sortis" value={kpis.sortis.toLocaleString("fr-FR")}
               sub={`${kpis.total ? Math.round((kpis.sortis / kpis.total) * 100) : 0}%`} tone="success" />
          <Kpi icon={ShieldAlert} label="Bloqués" value={kpis.bloques.toLocaleString("fr-FR")}
               sub={`${kpis.total ? Math.round((kpis.bloques / kpis.total) * 100) : 0}%`} tone="destructive" />
          <Kpi icon={Clock} label="Durée moy." value={`${kpis.avg} j`} sub="stockage" />
        </section>

        {/* Flow */}
        <Panel title="Flux mensuels" subtitle="Arrivées vs sorties" hint="Cliquez sur un mois pour filtrer.">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={byMois} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="gArr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gLivr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chart-3)" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="var(--color-chart-3)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.32 0.03 260 / 0.4)" />
                <XAxis dataKey="name" stroke="oklch(0.72 0.02 255)" fontSize={11} />
                <YAxis stroke="oklch(0.72 0.02 255)" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="arr" name="Arrivées" stroke="var(--color-chart-1)" strokeWidth={2} fill="url(#gArr)" />
                <Area type="monotone" dataKey="sortis" name="Sorties" stroke="var(--color-chart-3)" strokeWidth={2} fill="url(#gLivr)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Pies row */}
        <section className="grid gap-4 lg:grid-cols-4">
          <Panel title="Statut du parc" hint="Cliquez sur un secteur">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statutData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}
                       onClick={(d: { name: string }) => toggle("statut", d.name)} cursor="pointer">
                    {statutData.map((d, i) => (
                      <Cell key={i} fill={STATUT_COLOR[d.name] ?? CHART_COLORS[i % CHART_COLORS.length]}
                            stroke={f.statut === d.name ? "var(--color-foreground)" : "transparent"} strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="Carburant" hint="Cliquez sur un secteur">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={carburantData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}
                       onClick={(d: { name: string }) => toggle("carburant", d.name)} cursor="pointer">
                    {carburantData.map((d, i) => (
                      <Cell key={i} fill={CHART_COLORS[(i + 1) % CHART_COLORS.length]}
                            stroke={f.carburant === d.name ? "var(--color-foreground)" : "transparent"} strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="Type" hint="Cliquez sur un secteur">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={typeData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}
                       onClick={(d: { name: string }) => toggle("type", d.name)} cursor="pointer">
                    {typeData.map((d, i) => (
                      <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]}
                            stroke={f.type === d.name ? "var(--color-foreground)" : "transparent"} strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="État véhicule" hint="Cliquez sur un secteur">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={etatData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}
                       onClick={(d: { name: string }) => toggle("etat", d.name)} cursor="pointer">
                    {etatData.map((d, i) => (
                      <Cell key={i} fill={CHART_COLORS[(i + 3) % CHART_COLORS.length]}
                            stroke={f.etat === d.name ? "var(--color-foreground)" : "transparent"} strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </section>

        {/* Bars big */}
        <section className="grid gap-4 lg:grid-cols-2">
          <Panel title="Top modèles" subtitle="cliquez pour filtrer">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelData} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.32 0.03 260 / 0.4)" />
                  <XAxis type="number" stroke="oklch(0.72 0.02 255)" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="oklch(0.72 0.02 255)" fontSize={11} width={80} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "oklch(0.3 0.04 260 / 0.3)" }} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} onClick={(d: { name: string }) => toggle("modele", d.name)} cursor="pointer">
                    {modelData.map((d, i) => (
                      <Cell key={i} fill={f.modele === d.name ? "var(--color-primary)" : "var(--color-chart-1)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Occupation par zone" subtitle="cliquez pour filtrer">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={zoneData} margin={{ top: 4, right: 16, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.32 0.03 260 / 0.4)" />
                  <XAxis dataKey="name" stroke="oklch(0.72 0.02 255)" fontSize={11} />
                  <YAxis stroke="oklch(0.72 0.02 255)" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "oklch(0.3 0.04 260 / 0.3)" }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} onClick={(d: { name: string }) => toggle("zone", d.name)} cursor="pointer">
                    {zoneData.map((d, i) => (
                      <Cell key={i} fill={f.zone === d.name ? "var(--color-primary)" : "var(--color-chart-2)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </section>

        {/* Bars small */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Panel title={<span className="inline-flex items-center gap-1.5"><Factory className="h-3.5 w-3.5" />Pays d'origine</span>}>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paysData} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.32 0.03 260 / 0.4)" />
                  <XAxis dataKey="name" stroke="oklch(0.72 0.02 255)" fontSize={11} />
                  <YAxis stroke="oklch(0.72 0.02 255)" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "oklch(0.3 0.04 260 / 0.3)" }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} onClick={(d: { name: string }) => toggle("pays", d.name)} cursor="pointer">
                    {paysData.map((d, i) => (
                      <Cell key={i} fill={f.pays === d.name ? "var(--color-primary)" : "var(--color-chart-4)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title={<span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />Destinations</span>}>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={destData} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.32 0.03 260 / 0.4)" />
                  <XAxis dataKey="name" stroke="oklch(0.72 0.02 255)" fontSize={11} />
                  <YAxis stroke="oklch(0.72 0.02 255)" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "oklch(0.3 0.04 260 / 0.3)" }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} onClick={(d: { name: string }) => toggle("destination", d.name)} cursor="pointer">
                    {destData.map((d, i) => (
                      <Cell key={i} fill={f.destination === d.name ? "var(--color-primary)" : "var(--color-chart-5)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="Durée moy. par zone" subtitle="jours">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groupMean(filtered, "zone", "duree")} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.32 0.03 260 / 0.4)" />
                  <XAxis dataKey="name" stroke="oklch(0.72 0.02 255)" fontSize={11} />
                  <YAxis stroke="oklch(0.72 0.02 255)" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "oklch(0.3 0.04 260 / 0.3)" }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="var(--color-chart-6)" onClick={(d: { name: string }) => toggle("zone", d.name)} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </section>

        {/* Bars extra */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Panel title="Importateurs" hint="Cliquez pour filtrer">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={importData} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.32 0.03 260 / 0.4)" />
                  <XAxis dataKey="name" stroke="oklch(0.72 0.02 255)" fontSize={11} />
                  <YAxis stroke="oklch(0.72 0.02 255)" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "oklch(0.3 0.04 260 / 0.3)" }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} onClick={(d: { name: string }) => toggle("importateur", d.name)} cursor="pointer">
                    {importData.map((d, i) => (
                      <Cell key={i} fill={f.importateur === d.name ? "var(--color-primary)" : "var(--color-chart-3)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="Navires" hint="Cliquez pour filtrer">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={navireData} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.32 0.03 260 / 0.4)" />
                  <XAxis dataKey="name" stroke="oklch(0.72 0.02 255)" fontSize={11} />
                  <YAxis stroke="oklch(0.72 0.02 255)" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "oklch(0.3 0.04 260 / 0.3)" }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} onClick={(d: { name: string }) => toggle("navire", d.name)} cursor="pointer">
                    {navireData.map((d, i) => (
                      <Cell key={i} fill={f.navire === d.name ? "var(--color-primary)" : "var(--color-chart-2)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="Année du véhicule" hint="Cliquez pour filtrer">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={anneeData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
                           onClick={(e: { activeLabel?: string } | null) => e?.activeLabel && toggle("annee", e.activeLabel)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.32 0.03 260 / 0.4)" />
                  <XAxis dataKey="name" stroke="oklch(0.72 0.02 255)" fontSize={11} />
                  <YAxis stroke="oklch(0.72 0.02 255)" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "oklch(0.72 0.02 255 / 0.4)" }} />
                  <Line type="monotone" dataKey="value" stroke="var(--color-chart-1)" strokeWidth={2}
                        dot={{ r: 4, cursor: "pointer" }} activeDot={{ r: 6, cursor: "pointer" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </section>

        {/* Table */}
        <Panel title="Détail des véhicules" subtitle={`${filtered.length.toLocaleString("fr-FR")} résultats · page ${page}/${totalPages}`}>
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Marque / Modèle</th>
                  <th className="px-4 py-3 font-medium">Année</th>
                  <th className="px-4 py-3 font-medium">Carburant</th>
                  <th className="px-4 py-3 font-medium">Zone</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">État</th>
                  <th className="px-4 py-3 font-medium">Destination</th>
                  <th className="px-4 py-3 font-medium">Arrivée</th>
                  <th className="px-4 py-3 text-right font-medium">Durée</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((v) => (
                  <tr key={v.id} className="border-t border-border/60 transition-colors hover:bg-surface-2/60">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{v.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{v.marque}</div>
                      <div className="text-xs text-muted-foreground">{v.modele} · {v.couleur}</div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{v.annee}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="border-border/60 bg-surface-2 font-normal">{v.carburant}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{v.zone}</td>
                    <td className="px-4 py-3">{statutBadge(v.statut)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.etat}</td>
                    <td className="px-4 py-3">{v.destination}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.mois}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{v.duree} j</td>
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-16 text-center text-muted-foreground">Aucun véhicule ne correspond aux filtres.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Affichage {filtered.length ? (page - 1) * 20 + 1 : 0}–{Math.min(page * 20, filtered.length)} sur {filtered.length.toLocaleString("fr-FR")}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Précédent</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Suivant</Button>
            </div>
          </div>
        </Panel>

        <footer className="flex items-center justify-between border-t border-border/60 pt-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5" />
            Données mises à jour en continu · 50 000 véhicules
          </div>
          <div>© Marsa Maroc — Terminal Voiturier Tanger Med</div>
        </footer>
      </main>
    </div>
  );
}
