import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useIVBag } from "../context/IVBagContext";
import { Clock, Archive, User, FileText, CheckCircle2, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
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

export function History() {
  const navigate = useNavigate();
  const { bags, patients } = useIVBag();
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);
  const [expandedBag, setExpandedBag] = useState<string | null>(null);

  // Lọc bags đã hoàn thành
  const completedBags = bags.filter((b) => b.status === "completed").sort((a, b) => b.startTime - a.startTime);

  // Nhóm theo patientId
  const groupedByPatient = useMemo(() => {
    const groups: Record<string, typeof completedBags> = {};
    completedBags.forEach((bag) => {
      if (!groups[bag.patientId]) {
        groups[bag.patientId] = [];
      }
      groups[bag.patientId].push(bag);
    });
    return groups;
  }, [completedBags]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#6b7280',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 }, color: '#6b7280', maxTicksLimit: 6 },
      },
      y: {
        grid: { color: '#f0f0f0' },
        ticks: { font: { size: 10 }, color: '#6b7280' },
      },
    },
    animation: { duration: 300 },
  }), []);

  const getChartData = (bag: typeof completedBags[0]) => {
    const sortedLogs = [...bag.historyLogs].sort((a, b) => a.time - b.time);
    const labels = sortedLogs.map(log =>
      new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
    const volumeData = sortedLogs.map(log => Math.round(log.volume));

    return {
      labels,
      datasets: [{
        label: 'Thể tích (ml)',
        data: volumeData,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 2,
      }],
    };
  };

  const totalVolume = completedBags.reduce((sum, b) => sum + b.initialVolume, 0);
  const totalSessions = completedBags.length;
  const uniquePatients = Object.keys(groupedByPatient).length;
  const successSessions = completedBags.filter((b) => b.stopReason !== "ERROR").length;
  const errorSessions = completedBags.filter((b) => b.stopReason === "ERROR").length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lịch sử truyền dịch</h1>
          <p className="text-gray-500 text-sm mt-1">
            {totalSessions} phiên truyền từ {uniquePatients} bệnh nhân
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-gray-100 px-4 py-2 rounded-xl text-gray-700 font-medium flex items-center gap-2">
            <Archive size={18} />
            <span>{totalSessions} phiên</span>
          </div>
          <div className="bg-blue-50 px-4 py-2 rounded-xl text-blue-700 font-medium flex items-center gap-2">
            <User size={18} />
            <span>{uniquePatients} bệnh nhân</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Tổng thể tích đã truyền</p>
          <p className="text-2xl font-bold text-gray-900">{totalVolume.toLocaleString()} <span className="text-sm font-medium text-gray-400">ml</span></p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Phiên truyền thành công</p>
          <p className="text-2xl font-bold text-green-600">{successSessions}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Phiên có lỗi thiết bị</p>
          <p className="text-2xl font-bold text-red-600">{errorSessions}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Số bệnh nhân</p>
          <p className="text-2xl font-bold text-blue-600">{uniquePatients}</p>
        </div>
      </div>

      {completedBags.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 border-dashed">
          <Archive size={40} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-1">Chưa có lịch sử</h3>
          <p className="text-sm text-gray-400">Các bình truyền đã hoàn thành sẽ xuất hiện tại đây.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByPatient).map(([patientId, patientBags]) => {
            const patient = patients.find((p) => p.id === patientId);
            const isExpanded = expandedPatient === patientId;

            return (
              <div key={patientId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Patient Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedPatient(isExpanded ? null : patientId)}
                >
                  <div className="flex items-center gap-4">
                    <button className="p-1 text-gray-400">
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </button>
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      {patient?.name.charAt(0) || "?"}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        {patient?.name || "Không rõ"}
                        <span className="text-sm font-normal text-gray-500">({patientBags.length} phiên truyền)</span>
                      </h3>
                      <p className="text-sm text-gray-500">{patient ? `P${patient.room} G${patient.bed}` : "---"}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/patient/${patientId}`);
                    }}
                    className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Xem chi tiết
                  </button>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {patientBags.map((bag) => {
                      const isBagExpanded = expandedBag === bag.id;
                      const startDate = new Date(bag.startTime);

                      return (
                        <div key={bag.id} className="border-b border-gray-50 last:border-b-0">
                          {/* Bag Header */}
                          <div
                            className="flex items-center justify-between p-4 pl-20 cursor-pointer hover:bg-gray-50/50 transition-colors"
                            onClick={() => setExpandedBag(isBagExpanded ? null : bag.id)}
                          >
                            <div className="flex items-center gap-4">
                              <button className="p-1 text-gray-400">
                                {isBagExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </button>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-sm font-medium rounded-full">
                                <FileText size={14} />
                                {bag.type}
                              </span>
                              <span className="text-sm text-gray-600">
                                {startDate.toLocaleDateString('vi-VN')} | {bag.initialVolume} ml
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-xs text-gray-400">
                                {bag.historyLogs.length} điểm dữ liệu
                              </span>
                              {bag.stopReason === "ERROR" ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 text-sm font-medium rounded-full">
                                  <AlertTriangle size={14} />
                                  Lỗi thiết bị
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-sm font-medium rounded-full">
                                  <CheckCircle2 size={14} />
                                  Hoàn thành
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Chart */}
                          {isBagExpanded && (
                            <div className="px-20 pb-4">
                              <div className="bg-gray-50 rounded-xl p-4">
                                <p className="text-xs text-gray-500 mb-2">Biểu đồ thể tích theo thời gian</p>
                                <div className="h-48">
                                  <Line data={getChartData(bag)} options={chartOptions} />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
