export interface Patient {
  id: string;
  name: string;
  room: string;
  bed: string;
  age?: number;
  condition?: string;
}

export type BagStatus = "running" | "stopped" | "empty" | "completed";

export interface Esp32Device {
  id: string;
  patientId?: string;
  bagId?: string;
  registeredAt: number;
}

export interface DataPoint {
  time: number; // timestamp
  volume: number;
  flowRate: number; // drops/min
}

export interface ReportedMachine {
  esp32Id: string;
  reportedAt: number;
  roomBed?: string;
  status: "pending" | "resolved";
}

export interface IVBag {
  id: string;
  patientId: string;
  esp32Id?: string;
  type: string; // e.g., "Nước muối sinh lý 0.9%", "Glucose 5%"
  initialVolume: number;
  currentVolume: number;
  flowRate: number; // drops/min
  startTime: number;
  status: BagStatus;
  emptyTimestamp?: number;
  historyLogs: DataPoint[]; // Points for chart
}
