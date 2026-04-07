import React from "react";
import { useIVBag } from "../context/IVBagContext";
import { CheckCircle, AlertTriangle, Cpu } from "lucide-react";
import { toast } from "sonner";

export function Reports() {
  const { reportedMachines, resolveMachine } = useIVBag();

  const handleResolve = (esp32Id: string) => {
    resolveMachine(esp32Id);
    toast.success(`Đã đánh dấu hoàn thành sửa chữa thiết bị ${esp32Id}`);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <AlertTriangle className="text-orange-500" /> Danh sách thiết bị cần bảo trì
        </h1>
        <p className="text-gray-500 mt-2">
          Các thiết bị ESP32 đã được báo cáo lỗi hoặc cần bảo trì, sửa chữa.
        </p>
      </div>

      {reportedMachines.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <Cpu className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <h3 className="text-lg font-medium text-gray-900">Không có thiết bị lỗi</h3>
          <p className="text-gray-500 mt-1">Tất cả các máy ESP32 đang hoạt động bình thường.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reportedMachines.map((machine) => (
            <div
              key={machine.esp32Id}
              className="bg-white border border-red-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                    <Cpu size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{machine.esp32Id}</h3>
                    <p className="text-sm text-gray-500">{machine.roomBed}</p>
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-400 mb-4">
                Báo cáo lúc: {new Date(machine.reportedAt).toLocaleString("vi-VN")}
              </div>

              <button
                onClick={() => handleResolve(machine.esp32Id)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
              >
                <CheckCircle size={16} /> Đã sửa chữa xong (Xóa)
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
