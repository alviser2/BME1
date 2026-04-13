import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useIVBag } from "../context/IVBagContext";
import { ArrowLeft, User, Bed, Clock, Activity, FileText, Edit2 } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
import { Line } from "react-chartjs-2";
import { formatTimeRemaining, calculateTimeRemainingInMinutes, cn } from "../lib/utils";
import { EditPatientModal } from "../components/EditPatientModal";

// Đăng ký Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export function PatientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { patients, bags } = useIVBag();

  const patient = patients.find((p) => p.id === id);
  const patientBags = bags.filter((b) => b.patientId === id).sort((a, b) => b.startTime - a.startTime);

  const [selectedBagId, setSelectedBagId] = useState<string | null>(
    patientBags.length > 0 ? patientBags[0].id : null
  );

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const selectedBag = patientBags.find((b) => b.id === selectedBagId);

  // Chuẩn bị dữ liệu cho biểu đồ Chart.js
  const chartData = useMemo(() => {
    if (!selectedBag || selectedBag.historyLogs.length === 0) return null;

    // Sắp xếp theo thời gian tăng dần
    const sortedLogs = [...selectedBag.historyLogs].sort((a, b) => a.time - b.time);

    const labels = sortedLogs.map(log =>
      new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );

    const volumeData = sortedLogs.map(log => Math.round(log.volume));

    // Dùng thẳng flow_rate đã được BE lưu vào bag_logs tại mỗi lần ESP32 gửi data
    // Đơn vị: giọt/phút — không tính lại từ volume delta để tránh sai số timing
    const flowRateData = sortedLogs.map(log => Math.round(log.flowRate * 10) / 10);

    // Chỉ thêm điểm cuối = 0ml khi túi đã thực sự hoàn thành (để line chart đi xuống 0)
    // Không vẽ điểm 0 khi túi vẫn đang chạy
    if (selectedBag.status === 'completed' && sortedLogs.length > 0) {
      const lastTime = sortedLogs[sortedLogs.length - 1].time + 5000;
      labels.push(new Date(lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      volumeData.push(0);
      flowRateData.push(0);
    }

    return {
      labels,
      datasets: [
        {
          label: 'Thể tích (ml)',
          data: volumeData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
          spanGaps: true,
          pointRadius: 3,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#3b82f6',
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          yAxisID: 'y',
        },
        {
          label: 'Tốc độ (giọt/p)',
          data: flowRateData,
          borderColor: '#f97316',
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          fill: true,
          tension: 0.4,
          spanGaps: true,
          pointRadius: 3,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#f97316',
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          yAxisID: 'y1',
        },
      ],
    };
  }, [selectedBag]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: { size: 12 },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#6b7280',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: { size: 11 },
          color: '#6b7280',
          maxTicksLimit: 10,
        },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Thể tích (ml)',
          color: '#3b82f6',
          font: { size: 12 },
        },
        grid: {
          color: '#f0f0f0',
        },
        ticks: {
          font: { size: 11 },
          color: '#3b82f6',
        },
        min: 0,
        max: selectedBag?.initialVolume
          ? Math.ceil(selectedBag.initialVolume * 1.05 / 50) * 50
          : undefined,
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Tốc độ (giọt/p)',
          color: '#f97316',
          font: { size: 12 },
        },
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          font: { size: 11 },
          color: '#f97316',
        },
        min: 0,
      },
    },
    animation: {
      duration: 500,
    },
  }), [selectedBag]);

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
        <User size={48} className="text-gray-300" />
        <h2 className="text-xl font-medium text-gray-700">Không tìm thấy bệnh nhân</h2>
        <button
          onClick={() => navigate("/")}
          className="text-blue-600 hover:underline"
        >
          Quay lại trang chủ
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors font-medium text-sm"
      >
        <ArrowLeft size={16} />
        Quay lại
      </button>

      {/* Thông tin bệnh nhân */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row items-start md:items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-3xl font-bold flex-shrink-0">
          {patient.name.charAt(0)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Chỉnh sửa thông tin"
            >
              <Edit2 size={16} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
            <span className="flex items-center gap-2">
              <Bed size={16} className="text-gray-400"/> P{patient.room} G{patient.bed}
            </span>
            {patient.age && (
              <span className="flex items-center gap-2">
                <User size={16} className="text-gray-400"/> {patient.age} tuổi
              </span>
            )}
            {patient.condition && (
              <span className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full font-medium">
                <Activity size={14} className="text-blue-500"/> {patient.condition}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Danh sách bình truyền */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="font-semibold text-gray-900 px-1">Danh sách bình truyền ({patientBags.length})</h3>
          <div className="space-y-3">
            {patientBags.map((bag) => {
              const isActive = bag.id === selectedBagId;
              const isRunning = bag.status === "running";
              const isCompleted = bag.status === "completed";

              return (
                <div
                  key={bag.id}
                  onClick={() => setSelectedBagId(bag.id)}
                  className={cn(
                    "p-4 rounded-xl border cursor-pointer transition-all",
                    isActive
                      ? "bg-blue-50/50 border-blue-200 ring-1 ring-blue-500 shadow-sm"
                      : "bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900 flex items-center gap-2">
                      <FileText size={16} className={isActive ? "text-blue-600" : "text-gray-400"} />
                      {bag.type}
                    </h4>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full",
                      isRunning ? "bg-green-100 text-green-700" :
                      isCompleted ? "bg-gray-100 text-gray-600" :
                      "bg-orange-100 text-orange-700"
                    )}>
                      {bag.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 flex justify-between">
                    <span>{new Date(bag.startTime).toLocaleDateString('vi-VN')}</span>
                    <span>{bag.initialVolume} ml</span>
                  </div>
                </div>
              );
            })}

            {patientBags.length === 0 && (
              <div className="text-center p-6 bg-gray-50 rounded-xl text-gray-500 text-sm">
                Bệnh nhân chưa có lịch sử truyền dịch
              </div>
            )}
          </div>
        </div>

        {/* Biểu đồ & Chi tiết */}
        <div className="lg:col-span-2 space-y-6">
          {selectedBag ? (
            <>
              {/* Thống kê nhanh */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">Thể tích ban đầu</p>
                  <p className="text-lg font-bold text-gray-900">{selectedBag.initialVolume} <span className="text-sm font-medium text-gray-500">ml</span></p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">Đã truyền</p>
                  <p className="text-lg font-bold text-blue-600">{Math.round(selectedBag.initialVolume - selectedBag.currentVolume)} <span className="text-sm font-medium text-gray-500">ml</span></p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">Tốc độ hiện tại</p>
                  <p className="text-lg font-bold text-orange-500">{selectedBag.flowRate.toFixed(1)} <span className="text-sm font-medium text-gray-500">giọt/p</span></p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">Thời gian còn lại</p>
                  <p className="text-lg font-bold text-gray-900">
                    {selectedBag.status === 'completed' ? "---" : formatTimeRemaining(calculateTimeRemainingInMinutes(selectedBag.currentVolume, selectedBag.flowRate))}
                  </p>
                </div>
              </div>

              {/* Biểu đồ Chart.js */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900">Tiến trình truyền dịch</h3>
                  <p className="text-sm text-gray-500">Biểu đồ tổng quan thời gian so với khối lượng & tốc độ</p>
                </div>

                <div className="h-[400px] w-full">
                  {chartData && chartData.labels.length > 0 ? (
                    <Line data={chartData} options={chartOptions} />
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400">
                      Chưa đủ dữ liệu để vẽ biểu đồ
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-gray-50 rounded-2xl border border-gray-100 border-dashed py-20 text-gray-400">
               <Activity size={48} className="mb-4 opacity-50" />
               <p>Chọn một bình truyền để xem chi tiết</p>
            </div>
          )}
        </div>
      </div>

      <EditPatientModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        patient={patient}
        bag={selectedBag}
      />
    </div>
  );
}
