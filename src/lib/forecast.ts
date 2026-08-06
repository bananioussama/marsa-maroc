import { DATASET_SUMMARY } from "./dataset-summary";

export type MonthPoint = {
  mois: string;
  arrivees?: number;
  prevision?: number;
  bas?: number;
  haut?: number;
};

/**
 * Modèle de prévision : lissage exponentiel de Holt (niveau + tendance)
 * combiné à des indices saisonniers mensuels amortis, calibré sur les
 * arrivées mensuelles réelles du dataset.
 */
export function buildForecast(horizon = 6) {
  const months = Object.keys(DATASET_SUMMARY.monthly) as Array<
    keyof typeof DATASET_SUMMARY.monthly
  >;
  const values = months.map((m) => DATASET_SUMMARY.monthly[m].arrivees);
  const n = values.length;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  const meanX = (n - 1) / 2;

  // --- 1. Tendance de fond (régression linéaire) ---
  let num = 0;
  let den = 0;
  values.forEach((y, x) => {
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  });
  const lrSlope = den === 0 ? 0 : num / den;
  const lrIntercept = meanY - lrSlope * meanX;

  let ssRes = 0;
  let ssTot = 0;
  values.forEach((y, x) => {
    ssRes += (y - (lrIntercept + lrSlope * x)) ** 2;
    ssTot += (y - meanY) ** 2;
  });
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  // --- 2. Indices saisonniers amortis (ratio réel / tendance) ---
  const DAMPING = 0.6; // atténue la saisonnalité (un seul cycle observé)
  const seasonal: Record<number, number> = {};
  const counts: Record<number, number> = {};
  months.forEach((m, i) => {
    const monthNum = Number(String(m).split("-")[1]);
    const trend = lrIntercept + lrSlope * i;
    const ratio = trend > 0 ? values[i] / trend : 1;
    seasonal[monthNum] = (seasonal[monthNum] ?? 0) + ratio;
    counts[monthNum] = (counts[monthNum] ?? 0) + 1;
  });
  for (const k of Object.keys(seasonal)) {
    const key = Number(k);
    const raw = seasonal[key] / counts[key];
    seasonal[key] = 1 + (raw - 1) * DAMPING;
  }

  // --- 3. Lissage de Holt sur la série désaisonnalisée ---
  const alpha = 0.4;
  const beta = 0.15;
  const deseason = values.map((v, i) => {
    const monthNum = Number(String(months[i]).split("-")[1]);
    return v / (seasonal[monthNum] || 1);
  });
  let level = deseason[0];
  let trend = deseason.length > 1 ? deseason[1] - deseason[0] : 0;
  const fitted: number[] = [level];
  for (let i = 1; i < deseason.length; i++) {
    const prevLevel = level;
    const forecastStep = level + trend;
    fitted.push(forecastStep);
    level = alpha * deseason[i] + (1 - alpha) * forecastStep;
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  // --- 4. Erreurs du modèle sur l'historique (MAPE + écart-type) ---
  let absPct = 0;
  let sqErr = 0;
  values.forEach((raw, i) => {
    const y: number = raw;
    const monthNum = Number(String(months[i]).split("-")[1]);
    const pred = fitted[i] * (seasonal[monthNum] || 1);
    absPct += y === 0 ? 0 : Math.abs(y - pred) / y;
    sqErr += (y - pred) ** 2;
  });
  const mape = (absPct / n) * 100;
  const rmse = Math.sqrt(sqErr / n);

  const history: MonthPoint[] = months.map((m, i) => ({
    mois: String(m),
    arrivees: values[i],
  }));

  const last = String(months[months.length - 1]);
  const [ly, lm] = last.split("-").map(Number);
  const forecast: MonthPoint[] = [];
  for (let k = 1; k <= horizon; k++) {
    const monthNum = lm + k;
    const year = ly + Math.floor((monthNum - 1) / 12);
    const month = ((monthNum - 1) % 12) + 1;
    const base = level + trend * k;
    const value = Math.max(0, Math.round(base * (seasonal[month] || 1)));
    // l'incertitude croît avec l'horizon (~ RMSE * sqrt(k) * 1.28 ≈ 80%)
    const margin = Math.round(1.28 * rmse * Math.sqrt(k));
    forecast.push({
      mois: `${year}-${String(month).padStart(2, "0")}`,
      prevision: value,
      bas: Math.max(0, value - margin),
      haut: value + margin,
    });
  }

  const lastValue = values[n - 1];
  const monthlySlope = +(trend).toFixed(2);

  return {
    slope: monthlySlope,
    r2: +r2.toFixed(3),
    mape: +mape.toFixed(1),
    rmse: Math.round(rmse),
    moyenneMensuelle: Math.round(meanY),
    tendance: monthlySlope > 5 ? "hausse" : monthlySlope < -5 ? "baisse" : "stable",
    methode: "Holt (niveau + tendance) × indices saisonniers amortis",
    history,
    forecast,
    // série continue : le dernier point réel amorce la courbe de prévision
    series: [
      ...history.map((h, i) => ({
        ...h,
        ...(i === history.length - 1
          ? { prevision: lastValue, bas: lastValue, haut: lastValue }
          : {}),
      })),
      ...forecast,
    ] as MonthPoint[],
  };
}
