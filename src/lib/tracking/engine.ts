import type { Container, Dataset, ExceptionRecord, Flow, Movement } from "./source";

export const IMPORT_STAGES = [
  "VESSEL",
  "STS",
  "INTERNAL TRUCK",
  "YARD",
  "RTG",
  "INSPECTION",
  "TRUCK",
  "GATE OUT",
] as const;

export const EXPORT_STAGES = [
  "TRUCK",
  "GATE IN",
  "YARD",
  "RTG",
  "INTERNAL TRUCK",
  "QUAY",
  "STS",
  "VESSEL",
] as const;

const IMPORT_EVENT_STAGE: Record<string, number> = {
  VESSEL_ARRIVAL: 0,
  DISCHARGE_START: 1,
  DISCHARGE_COMPLETE: 1,
  INTERNAL_MOVE: 2,
  YARD_IN: 3,
  YARD_POSITIONED: 4,
  INSPECTION: 5,
  RELEASED: 6,
  TRUCK_LOADING: 6,
  GATE_OUT: 7,
};

const EXPORT_EVENT_STAGE: Record<string, number> = {
  TRUCK_ARRIVAL: 0,
  GATE_IN: 1,
  RECEIVED: 1,
  YARD_IN: 2,
  YARD_POSITIONED: 3,
  EXPORT_RELEASE: 3,
  RETRIEVAL: 4,
  QUAY_TRANSFER: 4,
  QUAY_ARRIVAL: 5,
  VESSEL_LOADING: 6,
  LOADING_COMPLETE: 7,
};

export const stagesFor = (flow: Flow): readonly string[] =>
  flow === "IMPORT" ? IMPORT_STAGES : EXPORT_STAGES;

export const stageOf = (flow: Flow, event: string): number =>
  (flow === "IMPORT" ? IMPORT_EVENT_STAGE : EXPORT_EVENT_STAGE)[event] ?? 0;

export type Severity = "NORMAL" | "WARNING" | "DELAY" | "CRITICAL";

export type Anomaly = {
  kind: "DELAY" | "EQUIPMENT UNAVAILABLE" | "LONG YARD DWELL" | "INSPECTION HOLD" | "ROUTE ANOMALY";
  severity: Severity;
  containerId: string;
  message: string;
  detail: string;
  equipment?: string;
  location?: string;
  minutes: number;
  impactMin: number;
  recommendation: string;
  time: number;
};

export type Journey = {
  container: Container;
  stages: readonly string[];
  events: Movement[];
  pending: Movement[];
  current?: Movement;
  next?: Movement;
  stageIndex: number;
  nextStage?: string;
  progress: number;
  position: string;
  yardBlock: string;
  equipment: string;
  elapsedMin: number;
  anomalies: Anomaly[];
  severity: Severity;
  inTransit: boolean;
  finished: boolean;
  started: boolean;
};

export const DELAY_MIN = 45;
export const YARD_DWELL_HOURS = 36;
export const INSPECTION_MIN = 90;
export const EQUIPMENT_GAP_MIN = 150;

const minutes = (a: number, b: number) => Math.max(0, Math.round((b - a) / 60000));

const severityRank: Record<Severity, number> = { NORMAL: 0, WARNING: 1, DELAY: 2, CRITICAL: 3 };

export function blockOf(position: string): string {
  const m = /^([A-Z]\d{2})/.exec(position || "");
  return m ? m[1] : "";
}

function detectAnomalies(
  container: Container,
  events: Movement[],
  exceptions: ExceptionRecord[],
  now: number,
): Anomaly[] {
  const out: Anomaly[] = [];

  for (const m of events) {
    if (m.duration > DELAY_MIN) {
      const over = m.duration - DELAY_MIN;
      out.push({
        kind: "DELAY",
        severity: m.duration > DELAY_MIN * 2 ? "CRITICAL" : "DELAY",
        containerId: container.id,
        message: `${m.cheType || "CHE"} DELAY`,
        detail: `${m.event.replace(/_/g, " ")} a duré ${m.duration} min (seuil ${DELAY_MIN} min).`,
        equipment: m.che,
        location: m.yard || m.to,
        minutes: m.duration,
        impactMin: over,
        recommendation: m.cheType === "RTG" ? `Réaffecter un autre RTG sur ${blockOf(m.yard)}` : `Réaffecter un autre ${m.cheType || "engin"}`,
        time: m.time,
      });
    }
    const routeBroken =
      (m.event === "INTERNAL_MOVE" && m.from !== "Truck_Internal") ||
      (m.event === "GATE_OUT" && m.from !== "Truck_External" && m.from !== "Gate") ||
      (m.event === "DISCHARGE_START" && m.from !== "Vessel");
    if (routeBroken) {
      out.push({
        kind: "ROUTE ANOMALY",
        severity: "WARNING",
        containerId: container.id,
        message: "ROUTE ANOMALY",
        detail: `${m.event.replace(/_/g, " ")} : ${m.from} → ${m.to} incohérent avec le type de mouvement.`,
        equipment: m.che,
        location: m.to,
        minutes: 0,
        impactMin: 0,
        recommendation: "Vérifier la séquence TOS et la position déclarée",
        time: m.time,
      });
    }
  }

  for (let i = 1; i < events.length; i++) {
    const gap = minutes(events[i - 1].end || events[i - 1].time, events[i].time);
    if (gap > EQUIPMENT_GAP_MIN) {
      out.push({
        kind: "EQUIPMENT UNAVAILABLE",
        severity: gap > EQUIPMENT_GAP_MIN * 2 ? "DELAY" : "WARNING",
        containerId: container.id,
        message: "EQUIPMENT UNAVAILABLE",
        detail: `Aucun mouvement pendant ${gap} min avant ${events[i].event.replace(/_/g, " ")}.`,
        equipment: events[i].che,
        location: events[i].yard || events[i].from,
        minutes: gap,
        impactMin: gap - EQUIPMENT_GAP_MIN,
        recommendation: `Assigner un engin disponible (${events[i].cheType || "CHE"})`,
        time: events[i].time,
      });
    }
  }

  const yardIn = events.find((m) => m.event === "YARD_IN");
  if (yardIn) {
    const leave = events.find((m) => m.time > yardIn.time && ["RETRIEVAL", "TRUCK_LOADING", "GATE_OUT", "LOADING_COMPLETE"].includes(m.event));
    const dwellMin = minutes(yardIn.time, leave ? leave.time : now);
    if (dwellMin > YARD_DWELL_HOURS * 60) {
      out.push({
        kind: "LONG YARD DWELL",
        severity: dwellMin > YARD_DWELL_HOURS * 120 ? "CRITICAL" : "DELAY",
        containerId: container.id,
        message: "LONG YARD DWELL",
        detail: `Séjour yard de ${(dwellMin / 60).toFixed(1)} h sur ${blockOf(yardIn.yard) || yardIn.yard}.`,
        equipment: yardIn.che,
        location: yardIn.yard,
        minutes: dwellMin,
        impactMin: dwellMin - YARD_DWELL_HOURS * 60,
        recommendation: "Prioriser la sortie / planifier un rehandle",
        time: yardIn.time,
      });
    }
  }

  for (const e of exceptions) {
    if (e.start > now) continue;
    if (e.type === "INSPECTION" && e.duration > INSPECTION_MIN) {
      out.push({
        kind: "INSPECTION HOLD",
        severity: e.duration > INSPECTION_MIN * 2 ? "CRITICAL" : "DELAY",
        containerId: container.id,
        message: "INSPECTION HOLD",
        detail: `${e.reason} — ${e.duration} min.`,
        location: "INSPECTION",
        minutes: e.duration,
        impactMin: e.duration - INSPECTION_MIN,
        recommendation: "Relancer la douane / escalader au superviseur",
        time: e.start,
      });
    } else if (e.type !== "INSPECTION") {
      out.push({
        kind: "DELAY",
        severity: e.duration > 90 ? "CRITICAL" : "DELAY",
        containerId: container.id,
        message: "OPERATIONAL DELAY",
        detail: `${e.reason} — ${e.duration} min.`,
        location: "TERMINAL",
        minutes: e.duration,
        impactMin: Math.max(0, e.duration - 30),
        recommendation: "Rééquilibrer la charge des engins",
        time: e.start,
      });
    }
  }

  return out.sort((a, b) => b.time - a.time);
}

export function buildJourney(data: Dataset, containerId: string, now: number): Journey | null {
  const container = data.containerById.get(containerId);
  if (!container) return null;
  const all = data.movesByContainer.get(containerId) ?? [];
  const events = all.filter((m) => m.time <= now);
  const pending = all.filter((m) => m.time > now);
  const current = events[events.length - 1];
  const next = pending[0];
  const stages = stagesFor(container.flow);
  const stageIndex = current ? stageOf(container.flow, current.event) : 0;
  const exceptions = (data.excByContainer.get(containerId) ?? []).filter((e) => e.start <= now);
  const anomalies = detectAnomalies(container, events, exceptions, now);

  const finished = !!current && (current.event === "GATE_OUT" || current.event === "LOADING_COMPLETE");
  const started = events.length > 0;
  const progress = !started ? 0 : finished ? 100 : Math.round(((stageIndex + 1) / stages.length) * 100);
  const yardBlock = blockOf(current?.yard || "");
  const position = finished
    ? container.flow === "IMPORT"
      ? "GATE OUT"
      : "ON BOARD"
    : current
      ? current.to || current.yard
      : "PRE-ARRIVAL";
  const inTransit = !!current && ["INTERNAL_MOVE", "QUAY_TRANSFER", "RETRIEVAL", "TRUCK_LOADING", "DISCHARGE_COMPLETE"].includes(current.event);

  const severity = anomalies.reduce<Severity>(
    (acc, a) => (severityRank[a.severity] > severityRank[acc] ? a.severity : acc),
    "NORMAL",
  );

  return {
    container,
    stages,
    events,
    pending,
    current,
    next,
    stageIndex,
    nextStage: next ? stages[stageOf(container.flow, next.event)] : undefined,
    progress,
    position,
    yardBlock,
    equipment: current?.che ?? "—",
    elapsedMin: events.length ? minutes(events[0].time, now) : 0,
    anomalies,
    severity,
    inTransit,
    finished,
    started,
  };
}

export type Kpis = {
  activeContainers: number;
  activeMovements: number;
  inYard: number;
  inTransit: number;
  delayed: number;
  activeExceptions: number;
};

export function computeKpis(journeys: Journey[], data: Dataset, now: number): Kpis {
  let activeContainers = 0, inYard = 0, inTransit = 0, delayed = 0;
  for (const j of journeys) {
    if (!j.started || j.finished) continue;
    activeContainers++;
    if (j.inTransit) inTransit++;
    else if (j.yardBlock) inYard++;
    if (j.severity === "DELAY" || j.severity === "CRITICAL") delayed++;
  }
  const ids = new Set(journeys.map((j) => j.container.id));
  const activeMovements = data.movements.filter(
    (m) => ids.has(m.containerId) && m.start <= now && m.end >= now,
  ).length;
  const activeExceptions = data.exceptions.filter(
    (e) => ids.has(e.containerId) && e.start <= now && e.end >= now,
  ).length;
  return { activeContainers, activeMovements, inYard, inTransit, delayed, activeExceptions };
}

export type EquipmentState = {
  id: string;
  type: string;
  status: "WORKING" | "IDLE";
  container?: string;
  task?: string;
  movementId?: string;
  from?: string;
  to?: string;
  movesLastHour: number;
};

export function equipmentStates(data: Dataset, now: number, ids?: Set<string>): EquipmentState[] {
  const map = new Map<string, EquipmentState>();
  const hourAgo = now - 3600_000;
  for (const m of data.movements) {
    if (!m.che) continue;
    if (ids && !ids.has(m.containerId)) continue;
    let s = map.get(m.che);
    if (!s) {
      s = { id: m.che, type: m.cheType, status: "IDLE", movesLastHour: 0 };
      map.set(m.che, s);
    }
    if (m.end >= hourAgo && m.end <= now) s.movesLastHour++;
    if (m.start <= now && m.end >= now) {
      s.status = "WORKING";
      s.container = m.containerId;
      s.task = m.event.replace(/_/g, " ");
      s.movementId = m.id;
      s.from = m.from;
      s.to = m.to;
    }
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function buildReport(j: Journey) {
  const all = [...j.events, ...j.pending];
  const first = all[0];
  const last = all[all.length - 1];
  const equipment = [...new Set(j.events.map((m) => m.che).filter(Boolean))];
  const totalDelay = j.anomalies.reduce((s, a) => s + a.impactMin, 0);
  return {
    containerId: j.container.id,
    flow: j.container.flow,
    vessel: j.container.vessel,
    voyage: j.container.voyage,
    terminal: j.container.terminal,
    startTime: first?.time ?? 0,
    endTime: last?.time ?? 0,
    cycleMin: first && last ? minutes(first.time, last.time) : 0,
    position: j.position,
    movements: all.length,
    equipment,
    exceptions: j.anomalies.length,
    totalDelay,
    status: j.finished ? "COMPLETED" : j.started ? "IN PROGRESS" : "EXPECTED",
    severity: j.severity,
    progress: j.progress,
  };
}
