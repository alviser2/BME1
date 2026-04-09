import React, { useState, useMemo } from "react";
import { useIVBag } from "../context/IVBagContext";
import { Esp32Card } from "../components/Esp32Card";
import { AddDeviceModal } from "../components/AddDeviceModal";
import { AssignPatientModal } from "../components/AssignPatientModal";
import { Search, Plus, SlidersHorizontal, ArrowUpDown, Cpu } from "lucide-react";
import { calculateTimeRemainingInMinutes } from "../lib/utils";

type SortOption = "timeAsc" | "timeDesc" | "volAsc" | "volDesc";

export function Dashboard() {
  const { bags, patients, esp32Devices } = useIVBag();
  const [isAddDeviceModalOpen, setIsAddDeviceModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedEsp32Id, setSelectedEsp32Id] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("timeAsc");

  // Lọc ESP32 đang hoạt động (có bệnh nhân)
  const activeEsp32Devices = useMemo(() => {
    return esp32Devices.filter((d) => d.patientId);
  }, [esp32Devices]);

  const filteredAndSortedDevices = useMemo(() => {
    let result = esp32Devices; // Hiển thị tất cả ESP32, kể cả chưa gán

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter((device) => {
        if (!device.patientId) {
          // ESP32 chưa gán - tìm theo ID
          return device.id.toLowerCase().includes(lowerTerm);
        }
        const patient = patients.find((p) => p.id === device.patientId);
        return (
          device.id.toLowerCase().includes(lowerTerm) ||
          patient?.name.toLowerCase().includes(lowerTerm) ||
          (`P${patient?.room} G${patient?.bed}`).toLowerCase().includes(lowerTerm)
        );
      });
    }

    // Sắp xếp: ESP32 có bệnh nhân trước, chưa gán sau
    result.sort((a, b) => {
      // Có bệnh nhân luôn lên trước
      if (a.patientId && !b.patientId) return -1;
      if (!a.patientId && b.patientId) return 1;

      // Cùng có hoặc cùng không có bệnh nhân -> sắp xếp theo tùy chọn
      if (a.patientId && b.patientId) {
        const bagA = bags.find((b) => b.id === a.bagId);
        const bagB = bags.find((b) => b.id === b.bagId);

        if (bagA && bagB) {
          const timeA = calculateTimeRemainingInMinutes(bagA.currentVolume, bagA.flowRate);
          const timeB = calculateTimeRemainingInMinutes(bagB.currentVolume, bagB.flowRate);

          switch (sortBy) {
            case "timeAsc":
              return timeA - timeB;
            case "timeDesc":
              return timeB - timeA;
            case "volAsc":
              return bagA.currentVolume - bagB.currentVolume;
            case "volDesc":
              return bagB.currentVolume - bagA.currentVolume;
          }
        }
      }

      // Mặc định sắp xếp theo thời gian đăng ký (mới nhất trước)
      return b.registeredAt - a.registeredAt;
    });

    return result;
  }, [esp32Devices, patients, bags, searchTerm, sortBy]);

  // Stats
  const activeBags = bags.filter((b) => b.status !== "running" && b.status !== "stopped");
  const runningBags = bags.filter((b) => b.status === "running");
  const warningCount = runningBags.filter(
    (b) => b.currentVolume <= 50 || calculateTimeRemainingInMinutes(b.currentVolume, b.flowRate) <= 15
  ).length;
  const emptyCount = runningBags.filter((b) => b.status === "empty").length;
  const waitingCount = esp32Devices.filter((d) => !d.patientId).length;

  const handleAssignClick = (esp32Id: string) => {
    setSelectedEsp32Id(esp32Id);
    setIsAssignModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tổng Quan</h1>
          <p className="text-gray-500 text-sm mt-1">
            {esp32Devices.length} thiết bị | {activeEsp32Devices.length} đang hoạt động | {waitingCount} đang chờ
          </p>
        </div>

        <button
          onClick={() => setIsAddDeviceModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-all shadow-blue-600/20 font-medium"
        >
          <Plus size={20} />
          <span>Thêm thiết bị</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <Cpu size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Tổng thiết bị</p>
            <p className="text-2xl font-bold text-gray-900">{esp32Devices.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
            <SlidersHorizontal size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Đang hoạt động</p>
            <p className="text-2xl font-bold text-gray-900">{runningBags.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-orange-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
            <ArrowUpDown size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Sắp hết ({"<"} 15p)</p>
            <p className="text-2xl font-bold text-orange-500">{warningCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Đang chờ gán</p>
            <p className="text-2xl font-bold text-gray-500">{waitingCount}</p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Tìm kiếm thiết bị, bệnh nhân, phòng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <span className="text-sm text-gray-500 whitespace-nowrap">Sắp xếp theo:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none font-medium text-sm text-gray-700 flex-1 cursor-pointer"
          >
            <option value="timeAsc">Thời gian ít nhất</option>
            <option value="timeDesc">Thời gian nhiều nhất</option>
            <option value="volAsc">Thể tích ít nhất</option>
            <option value="volDesc">Thể tích nhiều nhất</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {filteredAndSortedDevices.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 border-dashed">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
            <Search size={32} />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">Không tìm thấy thiết bị</h3>
          <p className="text-gray-500 max-w-sm mx-auto">Thử thay đổi từ khóa tìm kiếm hoặc thêm thiết bị mới.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAndSortedDevices.map((device) => {
            const patient = device.patientId ? patients.find((p) => p.id === device.patientId) : undefined;
            const bag = device.bagId ? bags.find((b) => b.id === device.bagId) : undefined;
            return (
              <Esp32Card
                key={device.id}
                device={device}
                bag={bag}
                patient={patient}
                onClick={() => !device.patientId && handleAssignClick(device.id)}
              />
            );
          })}
        </div>
      )}

      <AddDeviceModal isOpen={isAddDeviceModalOpen} onClose={() => setIsAddDeviceModalOpen(false)} />
      {selectedEsp32Id && (
        <AssignPatientModal
          isOpen={isAssignModalOpen}
          onClose={() => {
            setIsAssignModalOpen(false);
            setSelectedEsp32Id(null);
          }}
          esp32Id={selectedEsp32Id}
        />
      )}
    </div>
  );
}
