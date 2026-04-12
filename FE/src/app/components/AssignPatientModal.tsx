import React, { useState } from "react";
import { useIVBag } from "../context/IVBagContext";
import { X } from "lucide-react";
import { toast } from "sonner";

interface AssignPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  esp32Id: string;
}

export function AssignPatientModal({ isOpen, onClose, esp32Id }: AssignPatientModalProps) {
  const { patients, addPatient, assignPatientToEsp32 } = useIVBag();

  const [selectedPatient, setSelectedPatient] = useState("new");
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState("");
  const [condition, setCondition] = useState("");
  const [room, setRoom] = useState("");
  const [bed, setBed] = useState("");
  const [bagType, setBagType] = useState("Nước muối sinh lý 0.9%");
  const [initialVolume, setInitialVolume] = useState("500");
  const [flowRate, setFlowRate] = useState("40");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let pId = selectedPatient;

    if (pId === "new") {
      if (!patientName || !room || !bed) {
        toast.error("Vui lòng nhập đầy đủ thông tin bệnh nhân");
        return;
      }
      try {
        pId = await addPatient({
          name: patientName,
          room,
          bed,
          age: age ? parseInt(age, 10) : undefined,
          condition: condition || undefined
        });
      } catch (err) {
        toast.error("Không thể tạo bệnh nhân. Vui lòng thử lại!");
        return;
      }
    }

    try {
      await assignPatientToEsp32(esp32Id, pId, {
        type: bagType,
        initialVolume: Number(initialVolume),
        flowRate: Number(flowRate),
      });
      toast.success(`Đã gán bệnh nhân cho thiết bị ${esp32Id}`);
    } catch (err) {
      toast.error("Không thể gán bệnh nhân. Vui lòng thử lại!");
      return;
    }
    onClose();
    // Reset form
    setSelectedPatient("new");
    setPatientName("");
    setAge("");
    setCondition("");
    setRoom("");
    setBed("");
    setBagType("Nước muối sinh lý 0.9%");
    setInitialVolume("500");
    setFlowRate("40");
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

        <h2 className="text-xl font-bold text-gray-800 mb-2">Gán Bệnh Nhân</h2>
        <p className="text-sm text-gray-500 mb-6">Thiết bị: <span className="font-mono font-medium">{esp32Id}</span></p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bệnh Nhân</label>
            <select
              value={selectedPatient}
              onChange={(e) => setSelectedPatient(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="new">+ Thêm bệnh nhân mới</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} - P{p.room} G{p.bed}
                </option>
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
                <div className="w-24">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tuổi</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="45"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phòng</label>
                  <input
                    type="text"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="101"
                  />
                </div>
                <div className="w-16">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giường</label>
                  <input
                    type="text"
                    value={bed}
                    onChange={(e) => setBed(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="1"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bệnh lý / Tình trạng</label>
                <input
                  type="text"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="VD: Sốt xuất huyết, Tiểu đường..."
                />
              </div>
            </>
          )}

          <div className="border-t pt-4 mt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Thông tin truyền dịch</p>

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

            <div className="flex gap-4 mt-3">
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
              Gán Bệnh Nhân
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
