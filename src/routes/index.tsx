import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { Ship, Car, PackageCheck, Warehouse, Clock, MapPin } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Voiturier Marsa Maroc — Tableau de bord" },
      { name: "description", content: "Suivi des véhicules importés au port : stock, livraisons, zones et flux mensuels." },
      { property: "og:title", content: "Voiturier Marsa Maroc — Tableau de bord" },
      { property: "og:description", content: "Suivi des véhicules importés : stock, livraisons, zones et flux mensuels." },
    ],
  }),
});

type Data = {
  total: number; enStock: number; livres: number; dureeMoyenne: number;
  marque: Record<string, number>; modele: Record<string, number>;
  type: Record<string, number>; carburant: Record<string, number>;
  transmission: Record<string, number>; couleur: Record<string, number>;
  importateur: Record<string, number>; paysOrigine: Record<string, number>;
  portOrigine: Record<string, number>; navire: Record<string, number>;
  zoneStockage: Record<string, number>; destination: Record<string, number>;
  statut: Record<string, number>; annee: Record<string, number>;
  arriveesParMois: Record<string, number>; dureeParZone: Record<string, number>;
  topRecents: Array<Record<string, string | number>>;
};

const toArr = (o: Record<string, number>) =>
  Object.entries(o).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

const COLORS = ["hsl(217 91% 60%)", "hsl(160 84% 39%)", "hsl(38 92% 50%)", "hsl(340 82% 55%)", "hsl(271 76% 53%)", "hsl(198 93% 60%)"];

function Kpi({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
            {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="rounded-lg bg-primary/10 p-3 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="h-72">{children}</CardContent>
    </Card>
  );
}

function Dashboard() {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => { fetch("/data/dashboard.json").then(r => r.json()).then(setD); }, []);

  if (!d) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Chargement…</div>;

  const mois = Object.entries(d.arriveesParMois).sort().map(([name, value]) => ({ name, value }));
  const zoneDuree = Object.entries(d.dureeParZone).map(([name, value]) => ({ name, value }));

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary p-2 text-primary-foreground"><Ship className="h-6 w-6" /></div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Voiturier Marsa Maroc</h1>
              <p className="text-sm text-muted-foreground">Tableau de bord — Import véhicules · {d.total.toLocaleString("fr-FR")} enregistrements</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={Car} label="Véhicules total" value={d.total.toLocaleString("fr-FR")} />
          <Kpi icon={Warehouse} label="En stock" value={d.enStock.toLocaleString("fr-FR")} sub={`${Math.round(d.enStock / d.total * 100)}% du parc`} />
          <Kpi icon={PackageCheck} label="Livrés" value={d.livres.toLocaleString("fr-FR")} sub={`${Math.round(d.livres / d.total * 100)}% du parc`} />
          <Kpi icon={Clock} label="Durée moy. stockage" value={`${d.dureeMoyenne} j`} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Arrivées par mois">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mois} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Répartition par marque">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={toArr(d.marque)} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="value" fill={COLORS[1]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <ChartCard title="Statut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={toArr(d.statut)} dataKey="value" nameKey="name" outerRadius={90} label>
                  {toArr(d.statut).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Carburant">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={toArr(d.carburant)} dataKey="value" nameKey="name" outerRadius={90} label>
                  {toArr(d.carburant).map((_, i) => <Cell key={i} fill={COLORS[(i + 1) % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Type de véhicule">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={toArr(d.type)} dataKey="value" nameKey="name" outerRadius={90} label>
                  {toArr(d.type).map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Top modèles">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={toArr(d.modele)} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="name" fontSize={11} width={70} />
                <Tooltip />
                <Bar dataKey="value" fill={COLORS[3]} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Occupation par zone de stockage">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={toArr(d.zoneStockage)} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="value" fill={COLORS[4]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <ChartCard title="Pays d'origine">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={toArr(d.paysOrigine)} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="value" fill={COLORS[0]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Importateurs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={toArr(d.importateur)} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="value" fill={COLORS[2]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Destinations">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={toArr(d.destination)} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="value" fill={COLORS[5]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Durée moyenne de stockage par zone (jours)">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneDuree} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="value" fill={COLORS[1]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Ports d'origine & navires">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[...toArr(d.portOrigine), ...toArr(d.navire)]} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="value" fill={COLORS[3]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" />Arrivées récentes</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">ID</th><th className="px-4 py-3">Marque</th><th className="px-4 py-3">Modèle</th>
                  <th className="px-4 py-3">Année</th><th className="px-4 py-3">Zone</th>
                  <th className="px-4 py-3">Statut</th><th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Arrivée</th><th className="px-4 py-3">Durée (j)</th>
                </tr>
              </thead>
              <tbody>
                {d.topRecents.slice(0, 15).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs">{r.ID_Vehicule}</td>
                    <td className="px-4 py-2">{r.Marque}</td>
                    <td className="px-4 py-2">{r.Modele}</td>
                    <td className="px-4 py-2">{r.Annee}</td>
                    <td className="px-4 py-2">{r.Zone_Stockage}</td>
                    <td className="px-4 py-2">
                      <Badge variant={r.Statut === "Livre" ? "default" : "secondary"}>{r.Statut}</Badge>
                    </td>
                    <td className="px-4 py-2">{r.Destination}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.Date_Arrivee}</td>
                    <td className="px-4 py-2">{r.Duree_Stockage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
