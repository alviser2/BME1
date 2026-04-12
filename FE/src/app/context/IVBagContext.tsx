import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { Patient, IVBag, BagStatus, DataPoint, ReportedMachine, Esp32Device } from "../types";
import { dropsToMlPerSec } from "../lib/utils";

// ========== CONSTANTS ==========
const API_BASE = "http://localhost:3001/api";
const MAX_HISTORY_ENTRIES = 1000; // Giới hạn log để tránh memory leak
const LOG_INTERVAL_MS = 5000;     // 5 giây - tần suất ghi log
const AUTO_COMPLETE_MS = 180000; // 3 phút - tự động complete sau khi empty
const TICK_INTERVAL_MS = 1000;   // 1 giây - interval tick
const POLL_MS = 5000;            // 5 giây - poll data từ backend

interface IVBagContextType {
  patients: Patient[];
  bags: IVBag[];
  esp32Devices: Esp32Device[];
  reportedMachines: ReportedMachine[];
  isLoading: boolean;
  isConnected: boolean;
  // Patient CRUD
  addPatient: (patient: Omit<Patient, "id">) => Promise<string>;
  updatePatient: (id: string, updates: Partial<Patient>) => Promise<void>;
  deletePatient: (id: string) => Promise<void>;
  // Bag CRUD
  addBag: (bag: Omit<IVBag, "id" | "startTime" | "status" | "historyLogs">) => Promise<string>;
  updateBag: (id: string, updates: Partial<IVBag>) => Promise<void>;
  deleteBag: (id: string) => Promise<void>;
  changeBagStatus: (id: string, status: BagStatus) => Promise<void>;
  completeBagManually: (id: string, stopReason?: "NORMAL" | "ERROR") => Promise<void>;
  // ESP32
  addEsp32: (esp32Id: string) => Promise<string>;
  assignPatientToEsp32: (esp32Id: string, patientId: string, bagInfo?: { type: string; initialVolume: number; flowRate: number }) => Promise<string>;
  releaseEsp32: (esp32Id: string) => Promise<void>;
  moveToMaintenance: (esp32Id: string) => Promise<void>;
  resolveMaintenance: (esp32Id: string) => Promise<void>;
  removeEsp32: (esp32Id: string) => Promise<void>;
  // Machine reports
  reportMachine: (esp32Id: string, roomBed: string) => Promise<void>;
  resolveMachine: (esp32Id: string) => Promise<void>;
  // Manual refresh
  refreshData: () => Promise<void>;
}

const IVBagContext = createContext<IVBagContextType | undefined>(undefined);

// ========== HELPER: Giới hạn log entries ==========
const trimHistoryLogs = (logs: DataPoint[]): DataPoint[] => {
  if (logs.length <= MAX_HISTORY_ENTRIES) return logs;
  return logs.slice(-MAX_HISTORY_ENTRIES);
};

// ========== TYPE MAPPING: Backend → Frontend ==========
const mapBagFromBackend = (b: any): IVBag => ({
  id: b.id,
  patientId: b.patient_id,
  esp32Id: b.esp32_id,
  type: b.type,
  initialVolume: parseFloat(b.initial_volume),
  currentVolume: parseFloat(b.current_volume),
  flowRate: parseFloat(b.flow_rate) || 0,
  startTime: b.start_time ? new Date(b.start_time).getTime() : Date.now(),
  status: b.status,
  emptyTimestamp: b.empty_timestamp ? new Date(b.empty_timestamp).getTime() : undefined,
  anomaly: b.anomaly,
  historyLogs: [],
});

const mapPatientFromBackend = (p: any): Patient => ({
  id: p.id,
  name: p.name,
  room: p.room,
  bed: p.bed,
  age: p.age,
  condition: p.condition,
});

const mapEsp32FromBackend = (d: any): Esp32Device => ({
  id: d.id,
  patientId: undefined,
  bagId: undefined,
  registeredAt: d.registered_at ? new Date(d.registered_at).getTime() : Date.now(),
  status: d.status,
});

const mapMachineFromBackend = (m: any): ReportedMachine => ({
  id: m.id,
  esp32Id: m.esp32_id,
  roomBed: m.room_bed,
  status: m.status,
  reportedAt: m.reported_at ? new Date(m.reported_at).getTime() : Date.now(),
  resolvedAt: m.resolved_at ? new Date(m.resolved_at).getTime() : undefined,
});

export function IVBagProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [bags, setBags] = useState<IVBag[]>([]);
  const [esp32Devices, setEsp32Devices] = useState<Esp32Device[]>([]);
  const [reportedMachines, setReportedMachines] = useState<ReportedMachine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const isActiveRef = useRef(true);

  // ========== FETCH DATA FROM BACKEND ==========
  const fetchAllData = useCallback(async () => {
    try {
      const [bagsRes, patientsRes, esp32Res, machinesRes] = await Promise.all([
        fetch(`${API_BASE}/bags/all`),
        fetch(`${API_BASE}/patients`),
        fetch(`${API_BASE}/esp32`),
        fetch(`${API_BASE}/machines/reported`),
      ]);

      if (!bagsRes.ok || !patientsRes.ok || !esp32Res.ok || !machinesRes.ok) {
        throw new Error("API error");
      }

      const [bagsData, patientsData, esp32Data, machinesData] = await Promise.all([
        bagsRes.json(),
        patientsRes.json(),
        esp32Res.json(),
        machinesRes.json(),
      ]);

      const mappedBags: IVBag[] = Array.isArray(bagsData) ? bagsData.map(mapBagFromBackend) : [];
      const mappedPatients: Patient[] = Array.isArray(patientsData) ? patientsData.map(mapPatientFromBackend) : [];
      const mappedMachines: ReportedMachine[] = Array.isArray(machinesData) ? machinesData.map(mapMachineFromBackend) : [];

      // Build esp32Devices with patientId và bagId từ bags
      // Vì esp32_devices table không có patient_id/bag_id, ta lấy từ bảng bags
      const mappedEsp32Devices: Esp32Device[] = Array.isArray(esp32Data) 
        ? esp32Data.map((d: any) => {
            // Tìm bag đang chạy của ESP32 này
            const activeBag = mappedBags.find((b) => b.esp32Id === d.id && b.status !== "completed");
            return {
              id: d.id,
              patientId: activeBag?.patientId,
              bagId: activeBag?.id,
              registeredAt: d.registered_at ? new Date(d.registered_at).getTime() : Date.now(),
              status: d.status,
            };
          })
        : [];

      setBags(mappedBags);
      setPatients(mappedPatients);
      setEsp32Devices(mappedEsp32Devices);
      setReportedMachines(mappedMachines);
      setIsConnected(true);
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setIsConnected(false);
    }
  }, []);

  // ========== FETCH BAG HISTORY ==========
  const fetchBagHistory = useCallback(async (bagId: string, bagIndex: number) => {
    try {
      const res = await fetch(`${API_BASE}/bags/${bagId}/history`);
      if (!res.ok) return;
      const history: any[] = await res.json();
      
      const mappedHistory = history.map((h) => ({
        time: new Date(h.time).getTime(),
        volume: parseFloat(h.volume),
        flowRate: parseFloat(h.flow_rate) || 0,
      }));

      setBags((prev) => {
        const updated = [...prev];
        if (updated[bagIndex]) {
          updated[bagIndex] = { ...updated[bagIndex], historyLogs: mappedHistory };
        }
        return updated;
      });
    } catch (err) {
      console.error("Failed to fetch bag history:", err);
    }
  }, []);

  // ========== INITIAL LOAD + POLL ==========
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchAllData();
      setIsLoading(false);
    };
    loadData();

    const pollTimer = setInterval(async () => {
      if (!document.hidden) {
        await fetchAllData();
      }
    }, POLL_MS);

    return () => clearInterval(pollTimer);
  }, [fetchAllData]);

  // ========== FETCH HISTORY FOR EACH BAG ==========
  useEffect(() => {
    bags.forEach((bag, index) => {
      if (bag.historyLogs.length === 0 && bag.status !== "completed") {
        fetchBagHistory(bag.id, index);
      }
    });
  }, [bags, fetchBagHistory]);

  // ========== PAUSE KHI TAB ẨN ==========
  useEffect(() => {
    const handleVisibilityChange = () => {
      isActiveRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // ========== TICK INTERVAL (chỉ cho bags không có ESP32) ==========
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isActiveRef.current) return;

      const now = Date.now();

      setBags((prev) => {
        let changed = false;
        const updatedBags = prev.map((bag) => {
          // Chỉ tick bags KHÔNG có ESP32 (bags có ESP32 sẽ được cập nhật từ backend)
          if (bag.status === "running" && !bag.esp32Id) {
            changed = true;
            const mlReduced = dropsToMlPerSec(bag.flowRate);
            const newVol = Math.max(0, bag.currentVolume - mlReduced);

            let updatedLogs = bag.historyLogs;
            const lastLog = updatedLogs.length > 0 ? updatedLogs[updatedLogs.length - 1] : null;
            if (!lastLog || now - lastLog.time >= LOG_INTERVAL_MS) {
              updatedLogs = trimHistoryLogs([...updatedLogs, { time: now, volume: newVol, flowRate: bag.flowRate }]);
            }

            if (newVol <= 0) {
              return { ...bag, currentVolume: 0, status: "empty", emptyTimestamp: now, historyLogs: updatedLogs };
            }
            return { ...bag, currentVolume: newVol, historyLogs: updatedLogs };
          }

          if (bag.status === "empty" && bag.emptyTimestamp) {
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

  // ========== MANUAL REFRESH ==========
  const refreshData = useCallback(async () => {
    await fetchAllData();
  }, [fetchAllData]);

  // ========== PATIENT CRUD ==========
  const addPatient = useCallback(async (p: Omit<Patient, "id">) => {
    const res = await fetch(`${API_BASE}/patients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    if (!res.ok) throw new Error("Failed to add patient");
    const newPatient = await res.json();
    setPatients((prev) => [...prev, mapPatientFromBackend(newPatient)]);
    return newPatient.id;
  }, []);

  const updatePatient = useCallback(async (id: string, updates: Partial<Patient>) => {
    const res = await fetch(`${API_BASE}/patients/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update patient");
    const updated = await res.json();
    setPatients((prev) => prev.map((p) => (p.id === id ? mapPatientFromBackend(updated) : p)));
  }, []);

  const deletePatient = useCallback(async (id: string) => {
    const res = await fetch(`${API_BASE}/patients/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete patient");
    setPatients((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ========== BAG CRUD ==========
  const addBag = useCallback(async (b: Omit<IVBag, "id" | "startTime" | "status" | "historyLogs">) => {
    const res = await fetch(`${API_BASE}/bags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: b.patientId,
        esp32Id: b.esp32Id,
        type: b.type,
        initialVolume: b.initialVolume,
        currentVolume: b.currentVolume,
        flowRate: b.flowRate,
      }),
    });
    if (!res.ok) throw new Error("Failed to add bag");
    const newBag = await res.json();
    const mappedBag = mapBagFromBackend(newBag);
    mappedBag.historyLogs = [{ time: Date.now(), volume: b.initialVolume, flowRate: b.flowRate }];
    setBags((prev) => [...prev, mappedBag]);
    return newBag.id;
  }, []);

  const updateBag = useCallback(async (id: string, updates: Partial<IVBag>) => {
    const res = await fetch(`${API_BASE}/bags/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update bag");
    const updated = await res.json();
    setBags((prev) => prev.map((b) => (b.id === id ? mapBagFromBackend(updated) : b)));
  }, []);

  const deleteBag = useCallback(async (id: string) => {
    const res = await fetch(`${API_BASE}/bags/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete bag");
    setBags((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const changeBagStatus = useCallback(async (id: string, status: BagStatus) => {
    const res = await fetch(`${API_BASE}/bags/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("Failed to change bag status");
    setBags((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
  }, []);

  const completeBagManually = useCallback(async (id: string, stopReason: "NORMAL" | "ERROR" = "NORMAL") => {
    await changeBagStatus(id, "completed");
  }, [changeBagStatus]);

  // ========== ESP32 CRUD ==========
  const addEsp32 = useCallback(async (esp32Id: string) => {
    const res = await fetch(`${API_BASE}/esp32/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ esp32_id: esp32Id }),
    });
    if (!res.ok) throw new Error("Failed to add ESP32");
    const newDevice = await res.json();
    setEsp32Devices((prev) => [...prev, mapEsp32FromBackend(newDevice)]);
    return esp32Id;
  }, []);

  const assignPatientToEsp32 = useCallback(async (esp32Id: string, patientId: string, bagInfo?: { type: string; initialVolume: number; flowRate: number }) => {
    if (bagInfo) {
      const bagId = await addBag({
        patientId,
        esp32Id,
        type: bagInfo.type,
        initialVolume: bagInfo.initialVolume,
        currentVolume: bagInfo.initialVolume,
        flowRate: bagInfo.flowRate,
      });
      // Refresh data immediately to update esp32Devices with new patientId/bagId
      await fetchAllData();
      return bagId;
    }
    await fetchAllData();
    return "";
  }, [addBag, fetchAllData]);

  const releaseEsp32 = useCallback(async (esp32Id: string) => {
    setEsp32Devices((prev) =>
      prev.map((d) => (d.id === esp32Id ? { ...d, patientId: undefined, bagId: undefined } : d))
    );
  }, []);

  const moveToMaintenance = useCallback(async (esp32Id: string) => {
    setEsp32Devices((prev) =>
      prev.map((d) => (d.id === esp32Id ? { ...d, maintenance: true, patientId: undefined, bagId: undefined } : d))
    );
  }, []);

  const resolveMaintenance = useCallback(async (esp32Id: string) => {
    setEsp32Devices((prev) =>
      prev.map((d) => (d.id === esp32Id ? { ...d, maintenance: false } : d))
    );
  }, []);

  const removeEsp32 = useCallback(async (esp32Id: string) => {
    setEsp32Devices((prev) => prev.filter((d) => d.id !== esp32Id));
  }, []);

  // ========== MACHINE REPORTS ==========
  const reportMachine = useCallback(async (esp32Id: string, roomBed: string) => {
    const res = await fetch(`${API_BASE}/machines/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ esp32_id: esp32Id, room_bed: roomBed }),
    });
    if (!res.ok) throw new Error("Failed to report machine");
    const newMachine = await res.json();
    setReportedMachines((prev) => [...prev, mapMachineFromBackend(newMachine)]);
  }, []);

  const resolveMachine = useCallback(async (esp32Id: string) => {
    const res = await fetch(`${API_BASE}/machines/${esp32Id}/resolve`, {
      method: "PUT",
    });
    if (!res.ok) throw new Error("Failed to resolve machine");
    setReportedMachines((prev) => prev.filter((m) => m.esp32Id !== esp32Id));
  }, []);

  return (
    <IVBagContext.Provider
      value={{
        patients,
        bags,
        esp32Devices,
        reportedMachines,
        isLoading,
        isConnected,
        addPatient,
        updatePatient,
        deletePatient,
        addBag,
        updateBag,
        deleteBag,
        changeBagStatus,
        completeBagManually,
        addEsp32,
        assignPatientToEsp32,
        releaseEsp32,
        removeEsp32,
        moveToMaintenance,
        resolveMaintenance,
        reportMachine,
        resolveMachine,
        refreshData,
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
