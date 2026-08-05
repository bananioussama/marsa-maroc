import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider, getLovableAiGatewayRunId } from "@/lib/ai-gateway.server";
import { DATASET_SUMMARY } from "@/lib/dataset-summary";
import { buildForecast } from "@/lib/forecast";

type ChatRequestBody = { messages?: unknown };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages requis", { status: 400 });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) {
          return new Response("Clé IA manquante", { status: 500 });
        }

        const forecast = buildForecast(6);
        const system = `Tu es "Marsa AI", l'analyste IA du terminal voiturier Marsa Maroc (Tanger Med).
Tu réponds UNIQUEMENT à partir du jeu de données réel ci-dessous (50 000 véhicules importés, année 2025).
Règles:
- Réponds en français, de façon claire, chiffrée et professionnelle.
- Cite toujours les chiffres exacts du dataset (nombres, pourcentages, moyennes).
- Utilise du markdown: titres courts, listes, tableaux quand c'est pertinent.
- Pour les prévisions de marché, appuie-toi sur la tendance et les prévisions fournies, explique la méthode (régression linéaire sur les arrivées mensuelles) et rappelle l'incertitude (R² fourni).
- Si une information n'existe pas dans le dataset, dis-le clairement au lieu d'inventer.

=== SYNTHÈSE DU DATASET (JSON) ===
${JSON.stringify(DATASET_SUMMARY)}

=== MODÈLE PRÉDICTIF (arrivées mensuelles) ===
${JSON.stringify({
  pente_par_mois: forecast.slope,
  r2: forecast.r2,
  moyenne_mensuelle: forecast.moyenneMensuelle,
  tendance: forecast.tendance,
  previsions_6_mois: forecast.forecast.map((f) => ({ mois: f.mois, prevision: f.prevision })),
})}`;

        const initialRunId = getLovableAiGatewayRunId(request);
        const gateway = createLovableAiGatewayProvider(key, initialRunId);

        const result = streamText({
          model: gateway("google/gemini-3.6-flash"),
          system,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});
