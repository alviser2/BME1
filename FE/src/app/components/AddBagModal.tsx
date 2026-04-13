import React, { useState } from "react";
import { useIVBag } from "../context/IVBagContext";
import { X, Wifi } from "lucide-react";
import { toast } from "sonner";

interface AddBagModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddBagModal({ isOpen, onClose }: AddBagModalProps) {
  const { patients, esp32Devices, addPatient, addBag } = useIVBag();
  
  // Lọc ESP32 đang online (rảnh)
  const availableEsp32 = esp32Devices.filter(d => d.status === 'online');

  const [selectedPatient, setSelectedPatient] = useState("new");
  const [patientName, setPatientName] = useState("");
  const [room, setRoom] = useState("");
  const [bed, setBed] = useState("");
  const [selectedEsp32, setSelectedEsp32] = useState("");
  const [bagType, setBagType] = useState("Nước muối sinh lý 0.9%");
  const [initialVolume, setInitialVolume] = useState("500");
  const [flowRate, setFlowRate] = useState("40");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let pId = selectedPatient;
    
    if (selectedPatient === "new") {
      if (!patientName || !room || !bed) {
        toast.error("Vui lòng nhập tên, phòng và giường cho bệnh nhân mới");
        return;
      }
      // await async function
      pId = await addPatient({ name: patientName, room, bed });
    }

    // Kiểm tra ESP32 đã chọn có đang online không
    if (selectedEsp32) {
      const esp = availableEsp32.find(e => e.id === selectedEsp32);
      if (!esp) {
        toast.error("ESP32 đã chọn không còn rảnh. Vui lòng chọn ESP32 khác.");
        return;
      }
    }

    try {
      await addBag({
        patientId: pId,
        esp32Id: selectedEsp32 || undefined,
        type: bagType,
        initialVolume: Number(initialVolume),
        currentVolume: Number(initialVolume),
        flowRate: Number(flowRate),
      });

      if (selectedEsp32) {
        toast.success(`Đã gán ESP32 ${selectedEsp32} vào bình truyền`);
      } else {
        toast.success("Đã thêm bình truyền thành công");
      }

      // Reset form
      setSelectedEsp32("");
      setPatientName("");
      setRoom("");
      setBed("");
      setSelectedPatient("new");
      onClose();
    } catch (error) {
      toast.error("Lỗi khi thêm bình truyền: " + (error as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:bg-gray-100 p-2 rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-gray-800 mb-6">Thêm Bình Truyền Mới</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bệnh Nhân</label>
            <select
              value={selectedPatient}
              onChange={(e) => setSelectedPatient(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="new">+ Thêm bệnh nhân mới</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.name} - P{p.room} G{p.bed}</option>
              ))}
            </select>
          </div>

          {selectedPatient === "new" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ Tên</label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nguyễn Văn A"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phòng</label>
                  <input
                    type="text"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="101"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giường</label>
                  <input
                    type="text"
                    value={bed}
                    onChange={(e) => setBed(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="1"
                  />
                </div>
              </div>
            </>
          )}

          {/* ESP32 Selection - MỚI */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-2">
                <Wifi size={16} className="text-green-600" />
                Thiết bị ESP32 (tuỳ chọn)
              </span>
            </label>
            <select
              value={selectedEsp32}
              onChange={(e) => setSelectedEsp32(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">-- Không gán ESP32 --</option>
              {availableEsp32.length === 0 ? (
                <option value="" disabled>Không có ESP32 rảnh</option>
              ) : (
                availableEsp32.map(esp => (
                  <option key={esp.id} value={esp.id}>
                    {esp.id} (rảnh)
                  </option>
                ))
              )}
            </select>
            {availableEsp32.length > 0 && (
              <p className="text-xs text-green-600 mt-1">
                Có {availableEsp32.length} thiết bị đang rảnh
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loại Dịch</label>
            <select
              value={bagType}
              onChange={(e) => setBagType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="Nước muối sinh lý 0.9%">Nước muối sinh lý 0.9%</option>
              <option value="Glucose 5%">Glucose 5%</option>
              <option value="Ringer Lactate">Ringer Lactate</option>
              <option value="Amino Acid">Amino Acid</option>
              <option value="Khác">Khác</option>
            </select>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Thể tích (ml)</label>
              <input
                type="number"
                value={initialVolume}
                onChange={(e) => setInitialVolume(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="50"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tốc độ (giọt/phút)</label>
              <input
                type="number"
                value={flowRate}
                onChange={(e) => setFlowRate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="10"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-colors font-medium"
            >
              Lưu & Bắt đầu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}