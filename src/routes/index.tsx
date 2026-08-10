import { createFileRoute, Link } from "@tanstack/react-router";
import { Car, Container, ArrowRight, Anchor, Brain, Ship, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import marsaLogo from "@/assets/marsa-maroc-logo.png.asset.json";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Marsa Maroc — Portail des tableaux de bord opérationnels" },
      { name: "description", content: "Accédez aux tableaux de bord Marsa Maroc : département Voiturerie (parc véhicules importés) et département Conteneurs (terminal, quai et yard)." },
      { property: "og:title", content: "Marsa Maroc — Portail des tableaux de bord" },
      { property: "og:description", content: "Départements Voiturerie et Conteneurs : KPI, flux et analyses temps réel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function DeptCard({
  to, icon: Icon, eyebrow, title, description, stats, accent,
}: {
  to: string; icon: React.ElementType; eyebrow: string; title: string;
  description: string; stats: { label: string; value: string }[]; accent: string;
}) {
  return (
    <Link
      to={to}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-surface-gradient p-8 shadow-elegant transition-all hover:-translate-y-1 hover:border-primary/50"
    >
      <div
        className="absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl transition-opacity duration-500 group-hover:opacity-80"
        style={{ background: accent, opacity: 0.25 }}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className={`rounded-2xl p-4 ring-1 ring-border/60`} style={{ background: accent, opacity: 0.95 }}>
          <Icon className="h-7 w-7 text-background" />
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
      </div>
      <p className="relative mt-6 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
      <h3 className="font-display relative mt-2 text-2xl font-semibold tracking-tight">{title}</h3>
      <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <div className="relative mt-6 grid grid-cols-3 gap-3 border-t border-border/50 pt-5">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="font-display text-lg font-semibold tabular-nums">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </Link>
  );
}

function Home() {
  return (
    <div className="min-h-screen bg-background bg-hero">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-elegant ring-1 ring-border/60">
              <img src={marsaLogo.url} alt="Logo Marsa Maroc" className="h-full w-full object-contain" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold leading-none">Marsa Maroc</h1>
              <p className="mt-1 text-xs text-muted-foreground">Portail décisionnel · Terminal Tanger Med</p>
            </div>
          </div>
          <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            Systèmes actifs
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-16">
        <section className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/60 px-4 py-1.5 text-xs text-muted-foreground">
            <Anchor className="h-3.5 w-3.5 text-primary" />
            Pilotage opérationnel unifié
          </span>
          <h2 className="font-display mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            Choisissez votre <span className="text-gradient-primary">département</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Deux univers d'exploitation, deux tableaux de bord interactifs : le parc véhicules importés
            et le terminal à conteneurs. Filtres dynamiques, KPI métiers et graphiques cliquables.
          </p>
        </section>

        <section className="mt-14 grid gap-6 md:grid-cols-2">
          <DeptCard
            to="/voiturerie"
            icon={Car}
            eyebrow="Département"
            title="Voiturerie"
            description="Suivi du parc véhicules importés : stock, inspections, blocages, zones de stockage, navires et livraisons vers les villes du Royaume."
            stats={[
              { label: "Véhicules", value: "50 000" },
              { label: "Zones", value: "5" },
              { label: "Graphiques", value: "13" },
            ]}
            accent="var(--color-chart-1)"
          />
          <DeptCard
            to="/conteneurs"
            icon={Container}
            eyebrow="Département"
            title="Conteneurs"
            description="Performance du terminal : volumes TEU, dwell time, productivité des grues, rehandles, reefers, holds douaniers et trafic navires par poste à quai."
            stats={[
              { label: "Conteneurs", value: "8 000" },
              { label: "Mouvements", value: "13 161" },
              { label: "Graphiques", value: "15" },
            ]}
            accent="var(--color-chart-2)"
          />
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Brain, title: "Marsa IA", text: "Agent prédictif entraîné sur vos données, prévisions à 6 mois.", to: "/assistant" },
            { icon: Ship, title: "Vue quai", text: "Escales, postes à quai et cadence des grues en un coup d'œil." },
            { icon: Layers, title: "Analyse TEU", text: "Volumes équivalent vingt pieds et occupation des blocs." },
          ].map((c) => {
            const Inner = (
              <div className="flex h-full items-start gap-3 rounded-2xl border border-border/60 bg-surface-gradient p-5 shadow-elegant transition-colors hover:border-primary/40">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary ring-1 ring-primary/20">
                  <c.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{c.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.text}</p>
                </div>
              </div>
            );
            return c.to ? (
              <Link key={c.title} to={c.to}>{Inner}</Link>
            ) : (
              <div key={c.title}>{Inner}</div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
