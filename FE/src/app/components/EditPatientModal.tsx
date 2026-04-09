import React, { useState, useEffect } from "react";
import { useIVBag } from "../context/IVBagContext";
import { X } from "lucide-react";
import { Patient, IVBag } from "../types";

interface EditPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
  bag: IVBag | undefined;
}

export function EditPatientModal({ isOpen, onClose, patient, bag }: EditPatientModalProps) {
  const { updatePatient, updateBag } = useIVBag();

  const [name, setName] = useState(patient.name);
  const [room, setRoom] = useState(patient.room);
  const [bed, setBed] = useState(patient.bed);
  const [age, setAge] = useState(patient.age?.toString() || "");
  const [condition, setCondition] = useState(patient.condition || "");
  const [bagType, setBagType] = useState(bag?.type || "");
  const [esp32Id, setEsp32Id] = useState(bag?.esp32Id || "");

  useEffect(() => {
    if (isOpen) {
      setName(patient.name);
      setRoom(patient.room);
      setBed(patient.bed);
      setAge(patient.age?.toString() || "");
      setCondition(patient.condition || "");
      setBagType(bag?.type || "");
      setEsp32Id(bag?.esp32Id || "");
    }
  }, [isOpen, patient, bag]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    updatePatient(patient.id, {
      name,
      room,
      bed,
      age: age ? parseInt(age, 10) : undefined,
      condition: condition || undefined
    });

    if (bag) {
      updateBag(bag.id, {
        type: bagType,
        esp32Id: esp32Id || undefined
      });
    }

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
        
        <h2 className="text-xl font-bold text-gray-800 mb-6">Chỉnh sửa thông tin</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700 border-b pb-2">Bệnh nhân</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Họ Tên</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Tuổi</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Phòng</label>
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="101"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Giường</label>
                <input
                  type="text"
                  value={bed}
                  onChange={(e) => setBed(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="1"
                />
              </div>
            </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bệnh lý / Tình trạng</label>
              <input
                type="text"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {bag && (
            <div className="space-y-4 pt-2">
              <h3 className="font-semibold text-gray-700 border-b pb-2">Bình dịch đang chọn</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại Dịch</label>
                <input
                  type="text"
                  value={bagType}
                  onChange={(e) => setBagType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mã ESP32 (Tùy chọn)</label>
                <input
                  type="text"
                  value={esp32Id}
                  onChange={(e) => setEsp32Id(e.target.value)}
                  placeholder="VD: ESP32_001"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Dùng để nhận dữ liệu thời gian thực từ phần cứng.</p>
              </div>
            </div>
          )}

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
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
