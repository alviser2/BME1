import React from "react";
import { IVBag, Patient } from "../types";
import { calculateTimeRemainingInMinutes, formatTimeRemaining, cn } from "../lib/utils";
import { AlertCircle, Play, Pause, CheckCircle, Activity, User, Bed, Clock, Edit2 } from "lucide-react";
import { useIVBag } from "../context/IVBagContext";
import { useNavigate } from "react-router";

import { EditPatientModal } from "./EditPatientModal";

interface BagCardProps {
  bag: IVBag;
  patient: Patient;
}

export function BagCard({ bag, patient }: BagCardProps) {
  const { changeBagStatus, completeBagManually } = useIVBag();
  const navigate = useNavigate();
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);

  const isRunning = bag.status === "running";
  const isEmpty = bag.status === "empty";
  const isCompleted = bag.status === "completed";
  const hasAnomaly = bag.anomaly === "FAST_DRAIN";

  const timeRemainingMinutes = calculateTimeRemainingInMinutes(bag.currentVolume, bag.flowRate);
  const percentRemaining = Math.max(0, Math.min(100, (bag.currentVolume / bag.initialVolume) * 100));

  // Cảnh báo nếu dưới 50ml hoặc dưới 15 phút (không áp dụng khi có anomaly)
  const isWarning = !hasAnomaly && !isEmpty && !isCompleted && (bag.currentVolume <= 50 || timeRemainingMinutes <= 15);

  const handleStopResume = (e: React.MouseEvent) => {
    e.stopPropagation();
    changeBagStatus(bag.id, isRunning ? "stopped" : "running");
  };

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    completeBagManually(bag.id, hasAnomaly ? "ERROR" : "NORMAL");
  };

  const statusColor = {
    running: "bg-green-500",
    stopped: "bg-yellow-500",
    empty: "bg-red-500",
    completed: "bg-gray-400"
  }[bag.status];

  return (
    <div
      onClick={() => navigate(`/patient/${patient.id}`)}
      className={cn(
        "bg-white rounded-2xl shadow-sm border p-5 relative overflow-hidden transition-all hover:shadow-md cursor-pointer group",
        hasAnomaly && bag.anomaly === "FAST_DRAIN" && "border-red-400 ring-2 ring-red-200",
        !hasAnomaly && isWarning && !isEmpty && "border-orange-300 ring-1 ring-orange-300",
        !hasAnomaly && isEmpty && "border-red-300 ring-1 ring-red-300",
        !hasAnomaly && !isWarning && !isEmpty && "border-gray-100"
      )}
    >
      {/* Background Pulse for Warning / Anomaly */}
      {hasAnomaly && bag.anomaly === "FAST_DRAIN" && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 animate-pulse" />
      )}
      {!hasAnomaly && isWarning && isRunning && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-orange-400 animate-pulse" />
      )}
      {!hasAnomaly && isEmpty && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 animate-pulse" />
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            {patient.name.charAt(0)}
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              {patient.name}
              {hasAnomaly && <AlertCircle size={16} className="text-red-500" />}
              {!hasAnomaly && isWarning && <AlertCircle size={16} className="text-orange-500" />}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditModalOpen(true);
                }}
                className="text-gray-400 hover:text-blue-600 transition-colors ml-1 p-1 rounded-full hover:bg-blue-50"
                title="Chỉnh sửa thông tin"
              >
                <Edit2 size={14} />
              </button>
            </h3>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Bed size={12} /> P{patient.room} G{patient.bed}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full bg-gray-50">
            <span className={cn("w-2 h-2 rounded-full", statusColor)} />
            {bag.status === "running" && "Đang truyền"}
            {bag.status === "stopped" && "Tạm dừng"}
            {bag.status === "empty" && "Đã hết dịch"}
            {bag.status === "completed" && "Hoàn thành"}
          </span>
        </div>
      </div>

      {/* Info Grid */}
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

      {/* Progress & Time */}
      <div className="mb-4">
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

      {/* Actions */}
      {!isCompleted && (
        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
          {hasAnomaly ? (
            <button
              onClick={handleComplete}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors"
            >
              <AlertCircle size={14}/> Tạm dừng
            </button>
          ) : (
            <>
              {!isEmpty && (
                <button
                  onClick={handleStopResume}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors",
                    isRunning
                      ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "bg-green-50 text-green-700 hover:bg-green-100"
                  )}
                >
                  {isRunning ? <><Pause size={14}/> Dừng</> : <><Play size={14}/> Tiếp</>}
                </button>
              )}
              <button
                onClick={handleComplete}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <CheckCircle size={14}/> Kết thúc
              </button>
            </>
          )}
        </div>
      )}

      {isEditModalOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <EditPatientModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            patient={patient}
            bag={bag}
          />
        </div>
      )}
    </div>
  );
}
