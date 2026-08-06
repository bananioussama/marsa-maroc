# Marsa IA : renommage, prévisions réelles, tooltips lisibles

## 1. Renommer "Marsa AI" en "Marsa IA"

Sur la page assistant : titre du navigateur (balise `title` et og:title), en-tête visible, et toutes les mentions textuelles. Le bouton d'accès depuis la page d'accueil reste cohérent avec le nouveau nom.

## 2. Prévisions réelles sur le graphe "Prévision des arrivées"

Aujourd'hui la prévision est une simple droite de régression linéaire, et la courbe de prévision n'est pas visuellement raccordée à l'historique.

Nouveau modèle, calculé à partir des arrivées mensuelles réelles du dataset :

- Décomposition tendance + saisonnalité : régression linéaire sur la tendance, puis calcul d'indices saisonniers mensuels (ratio moyenne du mois / tendance).
- Lissage exponentiel (Holt) sur le niveau et la pente pour donner plus de poids aux mois récents.
- Prévision finale = (niveau + pente x k) x indice saisonnier du mois visé.
- Intervalle de confiance (bande haute/basse) calculé à partir de l'erreur résiduelle du modèle sur l'historique.
- Indicateurs affichés : tendance, R², MAPE (erreur moyenne %), moyenne mensuelle, pente.

Rendu du graphe :

- La courbe de prévision démarre exactement au dernier point réel (raccord continu, pas de trou).
- Bande d'incertitude en dégradé autour de la prévision.
- Trait pointillé + repère visuel séparant historique et prévision.
- Tableau court des 6 mois prévus sous le graphe.

L'agent IA reçoit le même modèle enrichi (prévisions, MAPE, intervalle) pour que ses réponses citent les mêmes chiffres que le graphe.

## 3. Tooltips illisibles sur les graphes de la page d'accueil

Cause : le style du tooltip définit bien un fond sombre et une couleur de texte sur le conteneur, mais Recharts applique ses propres styles par défaut au libellé (`labelStyle`) et aux lignes de valeurs (`itemStyle`), qui restent en noir sur fond sombre.

Correction : ajouter `labelStyle` et `itemStyle` clairs sur tous les tooltips de la page d'accueil (et de la page assistant), avec les tokens de couleur du thème, plus un léger renfort de contraste sur le fond et la bordure.

## Détails techniques

- `src/lib/forecast.ts` : nouveau modèle Holt + indices saisonniers, sortie enrichie (`mape`, `lower`, `upper`, série continue).
- `src/routes/assistant.tsx` : renommage, graphe mis à jour (Area d'incertitude + Line de prévision raccordée), nouvelles métriques, tooltip lisible.
- `src/routes/api/chat.ts` : prompt système mis à jour avec le nouveau modèle et le nom "Marsa IA".
- `src/routes/index.tsx` : `tooltipStyle` complété par `labelStyle` / `itemStyle` appliqués à tous les `<Tooltip>`.
- `src/routes/index.tsx` : libellé du bouton d'accès à l'agent aligné sur "Marsa IA".
