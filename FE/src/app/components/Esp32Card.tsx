import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Esp32Device, IVBag, Patient } from "../types";
import { calculateTimeRemainingInMinutes, formatTimeRemaining, cn } from "../lib/utils";
import { AlertCircle, Activity, Clock, User, Wifi, WifiOff, Edit2, CheckCircle, AlertTriangle } from "lucide-react";
import { useIVBag } from "../context/IVBagContext";
import { EditPatientModal } from "./EditPatientModal";

interface Esp32CardProps {
  device: Esp32Device;
  bag?: IVBag;
  patient?: Patient;
  onClick?: () => void;
}

export function Esp32Card({ device, bag, patient, onClick }: Esp32CardProps) {
  const navigate = useNavigate();
  const { completeBagManually, releaseEsp32, moveToMaintenance, reportMachine } = useIVBag();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const hasPatient = !!device.patientId && !!patient;
  const isRunning = bag?.status === "running";
  const isEmpty = bag?.status === "empty";
  const isCompleted = bag?.status === "completed";
  const isAnomalyCritical = bag?.anomaly === "FAST_DRAIN";
  const hasAnomaly = isAnomalyCritical;

  const timeRemainingMinutes = bag ? calculateTimeRemainingInMinutes(bag.currentVolume, bag.flowRate) : 0;
  const percentRemaining = bag ? Math.max(0, Math.min(100, (bag.currentVolume / bag.initialVolume) * 100)) : 0;
  // Warning: sắp hết chai nhưng KHÔNG có anomaly
  const isWarning = hasPatient && !isEmpty && !isCompleted && !hasAnomaly && (bag!.currentVolume <= 50 || timeRemainingMinutes <= 15);

  const handleCardClick = () => {
    if (hasPatient && patient) {
      navigate(`/patient/${patient.id}`);
    } else if (onClick) {
      onClick();
    }
  };

  const handleEndSession = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (bag) {
      completeBagManually(bag.id, hasAnomaly ? "ERROR" : "NORMAL");
      releaseEsp32(device.id);
    }
  };

  const handlePause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (bag) {
      completeBagManually(bag.id, "ERROR");
      // Báo cáo lỗi + chuyển sang bảo trì
      reportMachine(device.id, patient ? `P${patient.room} G${patient.bed}` : device.id);
      moveToMaintenance(device.id);
    }
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className={cn(
          "bg-white rounded-2xl shadow-sm border p-5 relative overflow-hidden transition-all hover:shadow-md cursor-pointer group",
          !hasPatient && "border-dashed border-gray-300 bg-gray-50/50",
          hasPatient && hasAnomaly && bag?.anomaly === "FAST_DRAIN" && "border-red-400 ring-2 ring-red-200",
          hasPatient && !hasAnomaly && isWarning && !isEmpty && "border-orange-300 ring-1 ring-orange-300",
          hasPatient && !hasAnomaly && isEmpty && "border-red-300 ring-1 ring-red-300",
          hasPatient && !hasAnomaly && !isWarning && !isEmpty && "border-gray-100"
        )}
      >
        {/* Status indicator */}
        <div className="absolute top-0 left-0 right-0 h-1 flex">
          {!hasPatient && <div className="flex-1 bg-gray-300" />}
          {hasPatient && hasAnomaly && bag?.anomaly === "FAST_DRAIN" && <div className="flex-1 bg-red-500 animate-pulse" />}
          {hasPatient && !hasAnomaly && isRunning && <div className="flex-1 bg-green-500 animate-pulse" />}
          {hasPatient && !hasAnomaly && isEmpty && <div className="flex-1 bg-red-500 animate-pulse" />}
          {hasPatient && !hasAnomaly && isWarning && <div className="flex-1 bg-orange-400 animate-pulse" />}
          {hasPatient && isCompleted && <div className="flex-1 bg-gray-400" />}
        </div>

        {/* Header */}
        <div className="flex justify-between items-start mb-4 mt-1">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              hasPatient ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-400"
            )}>
              {hasPatient ? <Wifi size={20} /> : <WifiOff size={20} />}
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                {device.id}
                {isAnomalyCritical && <AlertCircle size={16} className="text-red-500" />}
                {!hasAnomaly && isWarning && <AlertCircle size={16} className="text-orange-500" />}
              </h3>
              {hasPatient && patient && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <User size={12} /> {patient.name} - P{patient.room} G{patient.bed}
                </p>
              )}
              {!hasPatient && (
                <p className="text-xs text-gray-400 italic">Chưa gán bệnh nhân</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasPatient && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditModalOpen(true);
                }}
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Chỉnh sửa thông tin"
              >
                <Edit2 size={16} />
              </button>
            )}

            {/* ESP32 Status Badge - dựa trên trạng thái thực của device */}
            <span className={cn(
              "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full",
              device.status === "online" && "bg-green-50 text-green-600",
              device.status === "busy" && "bg-blue-50 text-blue-600",
              device.status === "offline" && "bg-gray-100 text-gray-500"
            )}>
              <span className={cn(
                "w-2 h-2 rounded-full",
                device.status === "online" && "bg-green-500",
                device.status === "busy" && "bg-blue-500",
                device.status === "offline" && "bg-gray-400"
              )} />
              {device.status === "online" && "Online"}
              {device.status === "busy" && "Busy"}
              {device.status === "offline" && "Offline"}
            </span>
          </div>
        </div>

        {/* Patient Info */}
        {hasPatient && patient ? (
          <>
            <div className="mb-4">
              <p className="font-medium text-gray-800">{patient.name}</p>
              {patient.condition && (
                <p className="text-xs text-gray-500 mt-0.5">{patient.condition}</p>
              )}
            </div>

            {/* Info Grid */}
            {bag && (
              <div className="bg-gray-50/50 rounded-xl p-4 mb-4 grid grid-cols-2 gap-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Loại Dịch</p>
                  <p className="font-medium text-gray-800 text-sm truncate pr-2" title={bag.type}>
                    {bag.type}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <Activity size={12} /> Tốc độ
                  </p>
                  <p className="font-medium text-gray-800 text-sm">
                    {bag.flowRate.toFixed(1)} giọt/phút
                  </p>
                </div>
              </div>
            )}

            {/* Progress & Time */}
            {bag && (
              <div className="mb-2">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <p className="text-2xl font-bold text-gray-800">
                      {Math.round(bag.currentVolume)} <span className="text-sm font-medium text-gray-400">/ {bag.initialVolume} ml</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-0.5 flex items-center justify-end gap-1">
                      <Clock size={12} /> {isEmpty ? "Chờ xử lý" : "Ước tính còn"}
                    </p>
                    <p className={cn(
                      "font-bold text-sm",
                      isEmpty ? "text-red-500" : isWarning ? "text-orange-500" : "text-blue-600"
                    )}>
                      {isEmpty ? "0m" : formatTimeRemaining(timeRemainingMinutes)}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-1000 ease-linear",
                      isEmpty ? "bg-red-500" : isWarning ? "bg-orange-400" : "bg-blue-500"
                    )}
                    style={{ width: `${percentRemaining}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {(isRunning || isEmpty) && (
              <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                {hasAnomaly ? (
                  <>
                    <button
                      onClick={handlePause}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
                    >
                      <AlertTriangle size={14} />
                      Tạm dừng
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleEndSession}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                    >
                      <CheckCircle size={14} />
                      Kết thúc
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <User size={24} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 mb-3">Nhấn để gán bệnh nhân</p>
            <p className="text-xs text-gray-400">Thiết bị đang chờ kết nối</p>
          </div>
        )}
      </div>

      {hasPatient && patient && isEditModalOpen && (
        <EditPatientModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          patient={patient}
          bag={bag}
        />
      )}
    </>
  );
}
