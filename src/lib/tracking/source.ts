/**
 * Tracking data source layer.
 *
 * The UI only ever talks to a `TrackingSource`. Today the implementation reads
 * a pre-encoded JSON export of the terminal Excel file. Tomorrow the same
 * interface can be backed by a TOS API / WebSocket feed:
 *
 *   TOS API -> Backend -> Database -> Tracking Engine -> WebSocket -> Frontend
 *
 * Swap `excelJsonSource` for `createTosApiSource(url)` and nothing else changes.
 */

export type Flow = "IMPORT" | "EXPORT";

export type Container = {
  id: string;
  flow: Flow;
  iso: string;
  type: string;
  length: number;
  weight: number;
  line: string;
  booking: string;
  vessel: string;
  vesselId: string;
  voyage: string;
  origin: string;
  destination: string;
  terminal: string;
  hazardous: boolean;
  reefer: boolean;
};

export type Movement = {
  id: string;
  containerId: string;
  event: string;
  flow: Flow;
  time: number;
  from: string;
  to: string;
  terminal: string;
  vessel: string;
  che: string;
  cheType: string;
  yard: string;
  start: number;
  end: number;
  duration: number;
  status: string;
  exception: string;
  reason: string;
};

export type VesselCall = {
  callId: string;
  vesselId: string;
  vessel: string;
  voyage: string;
  line: string;
  origin: string;
  terminal: string;
  eta: number;
  ata: number;
  berth: number;
  etd: number;
  atd: number;
};

export type ExceptionRecord = {
  id: string;
  containerId: string;
  type: string;
  start: number;
  end: number;
  duration: number;
  reason: string;
};

export type Dataset = {
  containers: Container[];
  containerById: Map<string, Container>;
  movements: Movement[];
  movesByContainer: Map<string, Movement[]>;
  vessels: VesselCall[];
  exceptions: ExceptionRecord[];
  excByContainer: Map<string, ExceptionRecord[]>;
  range: [number, number];
};

export interface TrackingSource {
  load(): Promise<Dataset>;
}

type RawPayload = {
  dict: Record<string, string[]>;
  containers: (string | number)[][];
  movements: (string | number | null)[][];
  vessels: (string | number | null)[][];
  exceptions: (string | number | null)[][];
  range: [number, number];
};

const ms = (v: unknown) => (typeof v === "number" ? v * 1000 : 0);

function decode(raw: RawPayload): Dataset {
  const d = raw.dict;
  const s = (key: string, i: unknown) => d[key]?.[i as number] ?? "";

  const containers: Container[] = raw.containers.map((r) => ({
    id: String(r[0]),
    flow: r[1] === 1 ? "IMPORT" : "EXPORT",
    iso: s("iso", r[2]),
    type: s("ctype", r[3]),
    length: Number(r[4]),
    weight: Number(r[5]),
    line: s("line", r[6]),
    booking: String(r[7]),
    vessel: s("vessel", r[8]),
    vesselId: String(r[9]),
    voyage: s("voyage", r[10]),
    origin: s("port", r[11]),
    destination: s("port", r[12]),
    terminal: s("terminal", r[13]),
    hazardous: r[14] === 1,
    reefer: r[15] === 1,
  }));

  const movements: Movement[] = raw.movements.map((r) => ({
    id: String(r[0]),
    containerId: String(r[1]),
    event: s("event", r[2]),
    flow: r[3] === 1 ? "IMPORT" : "EXPORT",
    time: ms(r[4]),
    from: s("pos", r[5]),
    to: s("pos", r[6]),
    terminal: s("terminal", r[7]),
    vessel: s("vessel", r[8]),
    che: s("che", r[9]),
    cheType: s("chetype", r[10]),
    yard: s("pos", r[11]),
    start: ms(r[12]),
    end: ms(r[13]),
    duration: Number(r[14] ?? 0),
    status: s("status", r[15]),
    exception: s("excep", r[16]),
    reason: s("reason", r[17]),
  }));

  const vessels: VesselCall[] = raw.vessels.map((r) => ({
    callId: String(r[0]),
    vesselId: String(r[1]),
    vessel: s("vessel", r[2]),
    voyage: s("voyage", r[3]),
    line: s("line", r[4]),
    origin: s("port", r[5]),
    terminal: s("terminal", r[6]),
    eta: ms(r[7]),
    ata: ms(r[8]),
    berth: ms(r[9]),
    etd: ms(r[10]),
    atd: ms(r[11]),
  }));

  const exceptions: ExceptionRecord[] = raw.exceptions.map((r) => ({
    id: String(r[0]),
    containerId: String(r[1]),
    type: String(r[2]),
    start: ms(r[3]),
    end: ms(r[4]),
    duration: Number(r[5] ?? 0),
    reason: s("reason", r[6]),
  }));

  const containerById = new Map(containers.map((c) => [c.id, c]));
  const movesByContainer = new Map<string, Movement[]>();
  for (const m of movements) {
    const arr = movesByContainer.get(m.containerId);
    if (arr) arr.push(m);
    else movesByContainer.set(m.containerId, [m]);
  }
  for (const arr of movesByContainer.values()) arr.sort((a, b) => a.time - b.time);

  const excByContainer = new Map<string, ExceptionRecord[]>();
  for (const e of exceptions) {
    const arr = excByContainer.get(e.containerId);
    if (arr) arr.push(e);
    else excByContainer.set(e.containerId, [e]);
  }

  return {
    containers,
    containerById,
    movements,
    movesByContainer,
    vessels,
    exceptions,
    excByContainer,
    range: [raw.range[0] * 1000, raw.range[1] * 1000],
  };
}

export const excelJsonSource: TrackingSource = {
  async load() {
    const res = await fetch("/data/tracking.json");
    if (!res.ok) throw new Error("Impossible de charger les données de tracking");
    return decode((await res.json()) as RawPayload);
  },
};

/** Future real-time backend. Same contract, different transport. */
export function createTosApiSource(baseUrl: string): TrackingSource {
  return {
    async load() {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/tracking/snapshot`);
      if (!res.ok) throw new Error("TOS API unavailable");
      return decode((await res.json()) as RawPayload);
    },
  };
}
