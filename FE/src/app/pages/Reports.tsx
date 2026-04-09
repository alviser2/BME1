import React from "react";
import { useIVBag } from "../context/IVBagContext";
import { CheckCircle, AlertTriangle, Cpu } from "lucide-react";
import { toast } from "sonner";

export function Reports() {
  const { esp32Devices, patients, bags, resolveMaintenance, resolveMachine } = useIVBag();

  // Lọc thiết bị đang bảo trì
  const maintenanceDevices = esp32Devices.filter((d) => d.maintenance);

  const handleDone = (esp32Id: string) => {
    resolveMaintenance(esp32Id); // Xóa maintenance flag
    resolveMachine(esp32Id);    // Xóa khỏi reportedMachines
    toast.success(`Đã sửa xong, thiết bị ${esp32Id} đã quay lại dashboard`);
  };

  const getPatientName = (patientId?: string) => {
    if (!patientId) return "Không rõ";
    const patient = patients.find((p) => p.id === patientId);
    return patient?.name || "Không rõ";
  };

  const getBagInfo = (bagId?: string) => {
    if (!bagId) return null;
    return bags.find((b) => b.id === bagId);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <AlertTriangle className="text-orange-500" /> Danh sách thiết bị cần bảo trì
        </h1>
        <p className="text-gray-500 mt-2">
          Các thiết bị ESP32 đã được báo cáo lỗi và đang chờ sửa chữa.
        </p>
      </div>

      {maintenanceDevices.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <Cpu className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <h3 className="text-lg font-medium text-gray-900">Không có thiết bị lỗi</h3>
          <p className="text-gray-500 mt-1">Tất cả các máy ESP32 đang hoạt động bình thường.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {maintenanceDevices.map((device) => {
            const patientName = getPatientName(device.patientId);
            const bag = getBagInfo(device.bagId);

            return (
              <div
                key={device.id}
                className="bg-white border border-red-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                      <Cpu size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{device.id}</h3>
                      <p className="text-sm text-gray-500">Bệnh nhân: {patientName}</p>
                    </div>
                  </div>
                </div>

                {bag && (
                  <div className="text-xs text-gray-400 mb-3 bg-gray-50 rounded-lg p-2">
                    <p>Loại dịch: {bag.type}</p>
                    <p>Thể tích: {bag.initialVolume} ml</p>
                    <p>Nguyên nhân: <span className="text-red-600 font-medium">Lỗi thiết bị</span></p>
                  </div>
                )}

                <div className="text-xs text-gray-400 mb-4">
                  Thiết bị đã được chuyển vào bảo trì
                </div>

                <button
                  onClick={() => handleDone(device.id)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                >
                  <CheckCircle size={16} /> Đã sửa xong
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
