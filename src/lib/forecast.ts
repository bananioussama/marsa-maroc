import { DATASET_SUMMARY } from "./dataset-summary";

export type MonthPoint = { mois: string; arrivees: number; prevision?: number };

/** Régression linéaire simple sur les arrivées mensuelles. */
export function buildForecast(horizon = 6) {
  const months = Object.keys(DATASET_SUMMARY.monthly) as Array<
    keyof typeof DATASET_SUMMARY.monthly
  >;
  const values = months.map((m) => DATASET_SUMMARY.monthly[m].arrivees);
  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  values.forEach((y, x) => {
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  });
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;

  // R² pour la confiance
  let ssRes = 0;
  let ssTot = 0;
  values.forEach((y, x) => {
    const pred = intercept + slope * x;
    ssRes += (y - pred) ** 2;
    ssTot += (y - meanY) ** 2;
  });
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  const history: MonthPoint[] = months.map((m, i) => ({
    mois: String(m),
    arrivees: values[i],
  }));

  const last = String(months[months.length - 1]);
  const [ly, lm] = last.split("-").map(Number);
  const forecast: MonthPoint[] = [];
  for (let k = 1; k <= horizon; k++) {
    const idx = n - 1 + k;
    const monthNum = lm + k;
    const year = ly + Math.floor((monthNum - 1) / 12);
    const month = ((monthNum - 1) % 12) + 1;
    forecast.push({
      mois: `${year}-${String(month).padStart(2, "0")}`,
      arrivees: 0,
      prevision: Math.max(0, Math.round(intercept + slope * idx)),
    });
  }

  return {
    slope: +slope.toFixed(2),
    r2: +r2.toFixed(3),
    moyenneMensuelle: Math.round(meanY),
    tendance: slope > 5 ? "hausse" : slope < -5 ? "baisse" : "stable",
    history,
    forecast,
    series: [
      ...history.map((h, i) => ({
        ...h,
        prevision: i === history.length - 1 ? h.arrivees : undefined,
      })),
      ...forecast,
    ] as MonthPoint[],
  };
}
