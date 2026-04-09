import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { Patient, IVBag, BagStatus, DataPoint, ReportedMachine, Esp32Device } from "../types";
import { dropsToMlPerSec } from "../lib/utils";

// ========== CONSTANTS ==========
const MAX_HISTORY_ENTRIES = 1000; // Giới hạn log để tránh memory leak
const LOG_INTERVAL_MS = 5000;     // 5 giây - tần suất ghi log
const AUTO_COMPLETE_MS = 180000;  // 3 phút - tự động complete sau khi empty
const TICK_INTERVAL_MS = 1000;     // 1 giây - interval tick

interface IVBagContextType {
  patients: Patient[];
  bags: IVBag[];
  esp32Devices: Esp32Device[];
  addPatient: (patient: Omit<Patient, "id">) => string;
  updatePatient: (id: string, updates: Partial<Patient>) => void;
  addBag: (bag: Omit<IVBag, "id" | "startTime" | "status" | "historyLogs">) => string;
  updateBag: (id: string, updates: Partial<IVBag>) => void;
  deleteBag: (id: string) => void;
  changeBagStatus: (id: string, status: BagStatus) => void;
  completeBagManually: (id: string) => void;
  updateFromESP32: (esp32Id: string, data: { roomBed: string; remainingVolume: number; dropsPerSecond: number }) => void;
  reportedMachines: ReportedMachine[];
  reportMachine: (esp32Id: string, roomBed: string) => void;
  resolveMachine: (esp32Id: string) => void;
  addEsp32: (esp32Id: string) => string;
  assignPatientToEsp32: (esp32Id: string, patientId: string, bagInfo?: { type: string; initialVolume: number; flowRate: number }) => string;
  releaseEsp32: (esp32Id: string) => void;
  removeEsp32: (esp32Id: string) => void;
}

const mockPatients: Patient[] = [
  { id: "p1", name: "Nguyễn Văn A", room: "101", bed: "1", age: 45, condition: "Sốt xuất huyết" },
  { id: "p2", name: "Trần Thị B", room: "102", bed: "3", age: 60, condition: "Tiêu chảy cấp" },
  { id: "p3", name: "Lê Văn C", room: "205", bed: "2", age: 32, condition: "Mất nước" },
];

// Sinh dữ liệu lịch sử giả định cho 1 bình đang truyền (bắt đầu cách đây 1 giờ)
const generateMockHistory = (initialVol: number, flowRate: number, startTime: number): DataPoint[] => {
  const points: DataPoint[] = [];
  const interval = LOG_INTERVAL_MS; // dùng constant thay vì magic number

  let vol = initialVol;
  for (let t = startTime; t <= Date.now(); t += interval) {
    points.push({ time: t, volume: Math.max(0, vol), flowRate: flowRate + (Math.random() * 2 - 1) });
    vol -= (flowRate / 20) * 5;
  }
  return points;
};

const startTimeP1 = Date.now() - 3600 * 1000;

const mockBags: IVBag[] = [
  {
    id: "b1",
    patientId: "p1",
    esp32Id: "ESP32_001",
    type: "Nước muối sinh lý 0.9%",
    initialVolume: 500,
    currentVolume: 150,
    flowRate: 40,
    startTime: startTimeP1,
    status: "running",
    historyLogs: generateMockHistory(500, 40, startTimeP1),
  },
  {
    id: "b2",
    patientId: "p2",
    esp32Id: "ESP32_002",
    type: "Glucose 5%",
    initialVolume: 1000,
    currentVolume: 900,
    flowRate: 60,
    startTime: Date.now() - 15 * 60 * 1000,
    status: "running",
    historyLogs: generateMockHistory(1000, 60, Date.now() - 15 * 60 * 1000),
  },
  {
    id: "b3",
    patientId: "p3",
    type: "Ringer Lactate",
    initialVolume: 500,
    currentVolume: 0,
    flowRate: 30,
    startTime: Date.now() - 4 * 3600 * 1000,
    status: "completed",
    emptyTimestamp: Date.now() - 10 * 60 * 1000,
    historyLogs: generateMockHistory(500, 30, Date.now() - 4 * 3600 * 1000),
  },
];

// Mock ESP32 devices: 1 đã gắn bệnh nhân, 2 đang chờ
const mockEsp32Devices: Esp32Device[] = [
  { id: "ESP32_001", patientId: "p1", bagId: "b1", registeredAt: Date.now() - 3600 * 1000 },
  { id: "ESP32_002", patientId: "p2", bagId: "b2", registeredAt: Date.now() - 15 * 60 * 1000 },
  { id: "ESP32_003", registeredAt: Date.now() },
  { id: "ESP32_004", registeredAt: Date.now() },
];

const IVBagContext = createContext<IVBagContextType | undefined>(undefined);

// ========== HELPER: Giới hạn log entries ==========
const trimHistoryLogs = (logs: DataPoint[]): DataPoint[] => {
  if (logs.length <= MAX_HISTORY_ENTRIES) return logs;
  // Giữ last N entries (sliding window)
  return logs.slice(-MAX_HISTORY_ENTRIES);
};

export function IVBagProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>(mockPatients);
  const [bags, setBags] = useState<IVBag[]>(mockBags);
  const [esp32Devices, setEsp32Devices] = useState<Esp32Device[]>(mockEsp32Devices);
  const [reportedMachines, setReportedMachines] = useState<ReportedMachine[]>([]);
  const isActiveRef = useRef(true); // Ref để track visibility

  // ========== PAUSE KHI TAB ẨN ==========
  useEffect(() => {
    const handleVisibilityChange = () => {
      isActiveRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // ========== TICK INTERVAL ==========
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isActiveRef.current) return; // Skip tick nếu tab đang ẩn

      const now = Date.now();

      setBags((prev) => {
        let changed = false;
        const updatedBags = prev.map((bag) => {
          if (bag.status === "running") {
            changed = true;
            let newVol = bag.currentVolume;
            let newFlowRate = bag.flowRate;

            if (bag.esp32Id) {
              const currentDropsPerSec = bag.flowRate / 60;
              const newDropsPerSec = Math.max(0, currentDropsPerSec + (Math.random() * 0.2 - 0.1));
              newFlowRate = newDropsPerSec * 60;
              const mlReduced = dropsToMlPerSec(newFlowRate);
              newVol = Math.max(0, bag.currentVolume - mlReduced);
            } else {
              const mlReduced = dropsToMlPerSec(bag.flowRate);
              newVol = Math.max(0, bag.currentVolume - mlReduced);
            }

            // Record log theo interval
            let updatedLogs = bag.historyLogs;
            const lastLog = updatedLogs.length > 0 ? updatedLogs[updatedLogs.length - 1] : null;
            if (!lastLog || now - lastLog.time >= LOG_INTERVAL_MS) {
              updatedLogs = trimHistoryLogs([...updatedLogs, { time: now, volume: newVol, flowRate: newFlowRate }]);
            }

            if (newVol <= 0) {
              return { ...bag, currentVolume: 0, status: "empty", emptyTimestamp: now, historyLogs: updatedLogs, flowRate: newFlowRate };
            }
            return { ...bag, currentVolume: newVol, historyLogs: updatedLogs, flowRate: newFlowRate };
          }

          if (bag.status === "empty" && bag.emptyTimestamp) {
            // Auto complete sau 3 phút
            if (now - bag.emptyTimestamp >= AUTO_COMPLETE_MS) {
              changed = true;
              return { ...bag, status: "completed" };
            }
          }

          return bag;
        });

        return changed ? updatedBags : prev;
      });
    }, TICK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  // ========== CALLBACKS ==========
  const reportMachine = useCallback((esp32Id: string, roomBed: string) => {
    setReportedMachines((prev) => {
      if (prev.find((m) => m.esp32Id === esp32Id && m.status === "pending")) return prev;
      return [...prev, { esp32Id, reportedAt: Date.now(), roomBed, status: "pending" }];
    });
  }, []);

  const resolveMachine = useCallback((esp32Id: string) => {
    setReportedMachines((prev) => prev.filter((m) => m.esp32Id !== esp32Id));
  }, []);

  const addPatient = useCallback((p: Omit<Patient, "id">) => {
    const id = `p${Date.now()}`;
    setPatients((prev) => [...prev, { ...p, id }]);
    return id;
  }, []);

  const updatePatient = useCallback((id: string, updates: Partial<Patient>) => {
    setPatients((prev) => prev.map((pt) => (pt.id === id ? { ...pt, ...updates } : pt)));
  }, []);

  const addBag = useCallback((b: Omit<IVBag, "id" | "startTime" | "status" | "historyLogs">) => {
    const id = `b${Date.now()}`;
    const now = Date.now();
    const newBag: IVBag = {
      ...b,
      id,
      startTime: now,
      status: "running",
      historyLogs: [{ time: now, volume: b.initialVolume, flowRate: b.flowRate }],
    };
    setBags((prev) => [...prev, newBag]);
    return id;
  }, []);

  const updateBag = useCallback((id: string, updates: Partial<IVBag>) => {
    setBags((prev) => prev.map((bag) => (bag.id === id ? { ...bag, ...updates } : bag)));
  }, []);

  const deleteBag = useCallback((id: string) => {
    setBags((prev) => prev.filter((bag) => bag.id !== id));
  }, []);

  const changeBagStatus = useCallback((id: string, status: BagStatus) => {
    setBags((prev) => prev.map((bag) => (bag.id === id ? { ...bag, status } : bag)));
  }, []);

  const completeBagManually = useCallback((id: string) => {
    setBags((prev) => prev.map((bag) => (bag.id === id ? { ...bag, status: "completed" } : bag)));
  }, []);

  const updateFromESP32 = useCallback((esp32Id: string, data: { roomBed: string; remainingVolume: number; dropsPerSecond: number }) => {
    const now = Date.now();
    setBags((prevBags) => {
      let updatedBags = [...prevBags];
      const bagIndex = updatedBags.findIndex((b) => b.esp32Id === esp32Id && b.status !== "completed");

      if (bagIndex !== -1) {
        const bag = updatedBags[bagIndex];
        const newFlowRate = data.dropsPerSecond * 60;

        let newLogs = bag.historyLogs;
        const lastLog = newLogs.length > 0 ? newLogs[newLogs.length - 1] : null;
        if (!lastLog || now - lastLog.time >= LOG_INTERVAL_MS) {
          newLogs = trimHistoryLogs([...newLogs, { time: now, volume: data.remainingVolume, flowRate: newFlowRate }]);
        }

        let newStatus = bag.status;
        let emptyTime = bag.emptyTimestamp;
        if (data.remainingVolume <= 0 && bag.status === "running") {
          newStatus = "empty";
          emptyTime = now;
        } else if (data.remainingVolume > 0 && bag.status === "empty") {
          newStatus = "running";
          emptyTime = undefined;
        }

        updatedBags[bagIndex] = {
          ...bag,
          currentVolume: data.remainingVolume,
          flowRate: newFlowRate,
          historyLogs: newLogs,
          status: newStatus,
          emptyTimestamp: emptyTime,
        };

        setPatients((prevPatients) =>
          prevPatients.map((p) => {
            if (p.id !== bag.patientId) return p;
            const match = data.roomBed.match(/P(\d+)\s*-\s*G(\d+)/);
            if (match) {
              return { ...p, room: match[1], bed: match[2] };
            }
            return p;
          })
        );
      }
      return updatedBags;
    });
  }, []);

  // ========== ESP32 DEVICE CALLBACKS ==========
  const addEsp32 = useCallback((esp32Id: string) => {
    setEsp32Devices((prev) => {
      if (prev.find((d) => d.id === esp32Id)) return prev;
      return [...prev, { id: esp32Id, registeredAt: Date.now() }];
    });
    return esp32Id;
  }, []);

  const assignPatientToEsp32 = useCallback((esp32Id: string, patientId: string, bagInfo?: { type: string; initialVolume: number; flowRate: number }) => {
    // Create bag if bagInfo provided
    let bagId: string | undefined;
    if (bagInfo) {
      bagId = `b${Date.now()}`;
      const now = Date.now();
      const newBag: IVBag = {
        id: bagId,
        patientId,
        esp32Id,
        type: bagInfo.type,
        initialVolume: bagInfo.initialVolume,
        currentVolume: bagInfo.initialVolume,
        flowRate: bagInfo.flowRate,
        startTime: now,
        status: "running",
        historyLogs: [{ time: now, volume: bagInfo.initialVolume, flowRate: bagInfo.flowRate }],
      };
      setBags((prev) => [...prev, newBag]);
    }

    // Update ESP32 device with patientId and bagId
    setEsp32Devices((prev) =>
      prev.map((d) => (d.id === esp32Id ? { ...d, patientId, bagId } : d))
    );

    return bagId || "";
  }, []);

  // Giải phóng ESP32 - xóa patientId và bagId để có thể gán bệnh nhân mới
  const releaseEsp32 = useCallback((esp32Id: string) => {
    setEsp32Devices((prev) =>
      prev.map((d) => (d.id === esp32Id ? { ...d, patientId: undefined, bagId: undefined } : d))
    );
  }, []);

  const removeEsp32 = useCallback((esp32Id: string) => {
    setEsp32Devices((prev) => prev.filter((d) => d.id !== esp32Id));
  }, []);

  return (
    <IVBagContext.Provider
      value={{
        patients,
        bags,
        esp32Devices,
        addPatient,
        updatePatient,
        addBag,
        updateBag,
        deleteBag,
        changeBagStatus,
        completeBagManually,
        updateFromESP32,
        reportedMachines,
        reportMachine,
        resolveMachine,
        addEsp32,
        assignPatientToEsp32,
        releaseEsp32,
        removeEsp32,
      }}
    >
      {children}
    </IVBagContext.Provider>
  );
}

export function useIVBag() {
  const context = useContext(IVBagContext);
  if (!context) {
    throw new Error("useIVBag must be used within an IVBagProvider");
  }
  return context;
}
