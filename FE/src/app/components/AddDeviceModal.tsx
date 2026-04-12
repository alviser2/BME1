import React, { useState } from "react";
import { useIVBag } from "../context/IVBagContext";
import { X } from "lucide-react";
import { toast } from "sonner";

interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddDeviceModal({ isOpen, onClose }: AddDeviceModalProps) {
  const { esp32Devices, addEsp32 } = useIVBag();
  const [esp32Id, setEsp32Id] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedId = esp32Id.trim().toUpperCase();
    if (!trimmedId) {
      toast.error("Vui lòng nhập mã thiết bị ESP32");
      return;
    }
    if (esp32Devices.find((d) => d.id === trimmedId)) {
      toast.error("Thiết bị này đã được thêm trước đó");
      return;
    }
    
    // Gọi API đăng ký ESP32 lên backend
    try {
      const res = await fetch("http://localhost:3001/api/esp32/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ esp32_id: trimmedId }),
      });
      
      if (!res.ok) {
        throw new Error("Failed to register device");
      }
    } catch (err) {
      toast.error("Không thể kết nối Backend. Vui lòng chạy Backend trước!");
      return;
    }
    
    addEsp32(trimmedId);
    toast.success(`Đã thêm thiết bị ${trimmedId}`);
    setEsp32Id("");
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

        <h2 className="text-xl font-bold text-gray-800 mb-6">Thêm Thiết Bị Mới</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mã ESP32</label>
            <input
              type="text"
              value={esp32Id}
              onChange={(e) => setEsp32Id(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase"
              placeholder="ESP32_001"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">Nhập mã ID trên thiết bị ESP32</p>
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
              Thêm Thiết Bị
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
