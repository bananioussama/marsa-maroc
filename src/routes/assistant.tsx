import { createFileRoute, Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Bot, RefreshCw, Sparkle, TrendingUp,
} from "lucide-react";
import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Conversation, ConversationContent, ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { buildForecast } from "@/lib/forecast";
import { DATASET_SUMMARY } from "@/lib/dataset-summary";
import marsaLogo from "@/assets/marsa-maroc-logo.png.asset.json";

const STORAGE_KEY = "marsa-ai-conversation";

export const Route = createFileRoute("/assistant")({
  component: AssistantPage,
  head: () => ({
    meta: [
      { title: "Marsa IA — Analyste prédictif du parc véhicules" },
      {
        name: "description",
        content:
          "Agent IA entraîné sur 50 000 véhicules importés : prévisions du marché, analyses de stock, zones, navires et importateurs.",
      },
      { property: "og:title", content: "Marsa IA — Analyste prédictif du parc véhicules" },
      {
        property: "og:description",
        content: "Posez vos questions à l'IA analyste du terminal voiturier Marsa Maroc.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const SUGGESTIONS = [
  "Quelle est la prévision d'arrivées pour les 6 prochains mois ?",
  "Quelles marques dominent le parc et comment évoluent-elles ?",
  "Quelle zone de stockage est la plus saturée ?",
  "Quels importateurs et pays d'origine faut-il surveiller ?",
];

function loadMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as UIMessage[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function AssistantPage() {
  const forecast = useMemo(() => buildForecast(6), []);
  const [initialMessages] = useState<UIMessage[]>(() => loadMessages());
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [input, setInput] = useState("");

  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: "marsa-ai",
    messages: initialMessages,
    transport,
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (status === "streaming") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* quota */
    }
  }, [messages, status]);

  useEffect(() => {
    if (!isLoading) textareaRef.current?.focus();
  }, [isLoading]);

  const send = (text: string) => {
    const value = text.trim();
    if (!value || isLoading) return;
    setInput("");
    void sendMessage({ text: value });
  };

  const totalStock = DATASET_SUMMARY.dimensions.Statut["En Stock"] ?? 0;

  return (
    <div className="min-h-screen bg-background bg-hero">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-elegant ring-1 ring-border/60">
              <img
                src={marsaLogo.url}
                alt="Logo Marsa Maroc"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold leading-none">
                Marsa <span className="text-primary">IA</span>
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Analyste prédictif · entraîné sur {DATASET_SUMMARY.total.toLocaleString("fr-FR")} véhicules
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={() => {
                setMessages([]);
                if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
              }}
            >
              <RefreshCw className="h-4 w-4" /> Nouvelle discussion
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/voiturerie">
                <ArrowLeft className="h-4 w-4" /> Tableau de bord
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1200px] gap-6 px-6 py-8 lg:grid-cols-[1fr_340px]">
        {/* Chat */}
        <Card className="flex min-h-[640px] flex-col border-border/60 bg-surface-gradient shadow-elegant">
          <CardContent className="flex flex-1 flex-col gap-4 p-5">
            <Conversation className="flex-1">
              <ConversationContent className="gap-6">
                {messages.length === 0 ? (
                  <div className="mx-auto max-w-lg py-10 text-center">
                    <div className="mx-auto mb-4 w-fit rounded-2xl bg-primary/10 p-4 ring-1 ring-primary/30">
                      <Bot className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className="font-display text-2xl font-semibold">
                      Posez vos questions sur le <span className="text-gradient-primary">parc</span>
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      L'agent analyse les {DATASET_SUMMARY.total.toLocaleString("fr-FR")} véhicules du dataset
                      (marques, zones, navires, importateurs, durées) et prévoit l'évolution du marché.
                    </p>
                    <div className="mt-6 grid gap-2 text-left">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => send(s)}
                          className="rounded-lg border border-border/60 bg-background/40 px-4 py-3 text-sm transition hover:border-primary/50 hover:bg-primary/5"
                        >
                          <Sparkle className="mr-2 inline h-3.5 w-3.5 text-primary" />
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <Message key={message.id} from={message.role}>
                      <MessageContent>
                        {message.parts.map((part, i) =>
                          part.type === "text" ? (
                            <MessageResponse key={i}>{part.text}</MessageResponse>
                          ) : null,
                        )}
                      </MessageContent>
                    </Message>
                  ))
                )}

                {status === "submitted" && (
                  <Message from="assistant">
                    <MessageContent>
                      <Shimmer>Analyse du dataset…</Shimmer>
                    </MessageContent>
                  </Message>
                )}

                {error && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    Erreur : {error.message}. Réessayez dans un instant.
                  </div>
                )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>

            <PromptInput
              onSubmit={(_, event) => {
                event.preventDefault();
                send(input);
              }}
            >
              <PromptInputTextarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ex : quelle sera la charge du terminal au T1 2026 ?"
              />
              <PromptInputFooter className="justify-end">
                <PromptInputSubmit status={status} disabled={!input.trim() || isLoading} />
              </PromptInputFooter>
            </PromptInput>
          </CardContent>
        </Card>

        {/* Panneau prévision */}
        <div className="space-y-4">
          <Card className="border-border/60 bg-surface-gradient shadow-elegant">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Prévision des arrivées
                </div>
                <Badge
                  variant="outline"
                  className="border-primary/40 bg-primary/10 text-primary capitalize"
                >
                  {forecast.tendance}
                </Badge>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={forecast.series}>
                    <defs>
                      <linearGradient id="fc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis dataKey="mois" tick={{ fontSize: 10 }} interval={2} />
                    <YAxis tick={{ fontSize: 10 }} width={38} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "var(--color-popover-foreground)", fontWeight: 600 }}
                      itemStyle={{ color: "var(--color-popover-foreground)" }}
                      formatter={(value: number | number[], name: string) =>
                        Array.isArray(value)
                          ? [
                              `${Math.round(value[0]).toLocaleString("fr-FR")} – ${Math.round(value[1]).toLocaleString("fr-FR")}`,
                              name,
                            ]
                          : [Math.round(value).toLocaleString("fr-FR"), name]
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="bande"
                      name="Intervalle"
                      stroke="none"
                      fill="var(--color-chart-3, #f59e0b)"
                      fillOpacity={0.15}
                      connectNulls
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="arrivees"
                      name="Réel"
                      stroke="var(--color-primary)"
                      fill="url(#fc)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="prevision"
                      name="Prévision"
                      stroke="var(--color-chart-3, #f59e0b)"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={false}
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border/50 bg-background/40 p-3">
                  <dt className="text-xs text-muted-foreground">Moyenne / mois</dt>
                  <dd className="font-display text-lg font-semibold">
                    {forecast.moyenneMensuelle.toLocaleString("fr-FR")}
                  </dd>
                </div>
                <div className="rounded-lg border border-border/50 bg-background/40 p-3">
                  <dt className="text-xs text-muted-foreground">Erreur moyenne (MAPE)</dt>
                  <dd className="font-display text-lg font-semibold">{forecast.mape} %</dd>
                </div>
                <div className="rounded-lg border border-border/50 bg-background/40 p-3">
                  <dt className="text-xs text-muted-foreground">Pente / mois</dt>
                  <dd className="font-display text-lg font-semibold">
                    {forecast.slope > 0 ? "+" : ""}
                    {forecast.slope}
                  </dd>
                </div>
                <div className="rounded-lg border border-border/50 bg-background/40 p-3">
                  <dt className="text-xs text-muted-foreground">En stock</dt>
                  <dd className="font-display text-lg font-semibold">
                    {totalStock.toLocaleString("fr-FR")}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 overflow-hidden rounded-lg border border-border/50">
                <table className="w-full text-xs">
                  <thead className="bg-background/50 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Mois</th>
                      <th className="px-3 py-2 text-right font-medium">Prévision</th>
                      <th className="px-3 py-2 text-right font-medium">Fourchette</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.forecast.map((f) => (
                      <tr key={f.mois} className="border-t border-border/40">
                        <td className="px-3 py-1.5">{f.mois}</td>
                        <td className="px-3 py-1.5 text-right font-medium">
                          {f.prevision?.toLocaleString("fr-FR")}
                        </td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground">
                          {f.bas?.toLocaleString("fr-FR")} – {f.haut?.toLocaleString("fr-FR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Méthode : {forecast.methode}. Fiabilité tendance R² {forecast.r2}, RMSE{" "}
                {forecast.rmse.toLocaleString("fr-FR")} véhicules/mois.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-surface-gradient shadow-elegant">
            <CardContent className="p-5 text-sm">
              <p className="mb-2 font-medium">Base de connaissances de l'agent</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>· {DATASET_SUMMARY.total.toLocaleString("fr-FR")} véhicules, 12 mois d'historique</li>
                <li>· Marques, modèles, carburants, types, transmissions</li>
                <li>· Zones de stockage, statuts, états, durées moyennes</li>
                <li>· Navires, ports et pays d'origine, importateurs, destinations</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
