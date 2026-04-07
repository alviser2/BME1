import React, { useState } from "react";
import { useIVBag } from "../context/IVBagContext";
import { X } from "lucide-react";
import { toast } from "sonner";

interface AddBagModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddBagModal({ isOpen, onClose }: AddBagModalProps) {
  const { patients, addPatient, addBag } = useIVBag();
  
  const [selectedPatient, setSelectedPatient] = useState("new");
  const [patientName, setPatientName] = useState("");
  const [roomBed, setRoomBed] = useState("");
  const [bagType, setBagType] = useState("Nước muối sinh lý 0.9%");
  const [initialVolume, setInitialVolume] = useState("500");
  const [flowRate, setFlowRate] = useState("40");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let pId = selectedPatient;
    if (pId === "new") {
      if (!patientName || !roomBed) {
        toast.error("Vui lòng nhập tên và phòng/giường cho bệnh nhân mới");
        return;
      }
      pId = addPatient({ name: patientName, roomBed });
    }

    addBag({
      patientId: pId,
      type: bagType,
      initialVolume: Number(initialVolume),
      currentVolume: Number(initialVolume),
      flowRate: Number(flowRate),
    });

    onClose();
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
                <option key={p.id} value={p.id}>{p.name} - {p.roomBed}</option>
              ))}
            </select>
          </div>

          {selectedPatient === "new" && (
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ Tên</label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nguyễn Văn A"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Phòng/Giường</label>
                <input
                  type="text"
                  value={roomBed}
                  onChange={(e) => setRoomBed(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="P101 - G1"
                />
              </div>
            </div>
          )}

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
