import React from "react";
import { useIVBag } from "../context/IVBagContext";
import { Clock, Archive, User, FileText, CheckCircle2 } from "lucide-react";

export function History() {
  const { bags, patients } = useIVBag();
  const completedBags = bags.filter((b) => b.status === "completed").sort((a, b) => b.startTime - a.startTime);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lịch sử truyền dịch</h1>
          <p className="text-gray-500 text-sm mt-1">Danh sách các bình đã hoàn thành</p>
        </div>
        <div className="bg-gray-100 px-4 py-2 rounded-xl text-gray-700 font-medium flex items-center gap-2">
          <Archive size={18} />
          <span>Tổng cộng: {completedBags.length}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {completedBags.length === 0 ? (
          <div className="text-center py-20 bg-gray-50/50">
            <Archive size={40} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-1">Chưa có lịch sử</h3>
            <p className="text-sm text-gray-400">Các bình truyền đã xong sẽ xuất hiện tại đây.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 text-sm font-medium border-b border-gray-100">
                  <th className="px-6 py-4 rounded-tl-xl">Thời gian bắt đầu</th>
                  <th className="px-6 py-4">Bệnh nhân</th>
                  <th className="px-6 py-4">Phòng/Giường</th>
                  <th className="px-6 py-4">Loại dịch</th>
                  <th className="px-6 py-4">Thể tích</th>
                  <th className="px-6 py-4 text-right rounded-tr-xl">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {completedBags.map((bag) => {
                  const patient = patients.find((p) => p.id === bag.patientId);
                  const startDate = new Date(bag.startTime);
                  
                  return (
                    <tr key={bag.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Clock size={16} className="text-gray-400" />
                          <span>
                            {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            <span className="mx-1 text-gray-300">|</span>
                            {startDate.toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs">
                          {patient?.name.charAt(0) || "?"}
                        </div>
                        {patient?.name || "Không rõ"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {patient?.roomBed || "---"}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-sm font-medium rounded-full">
                          <FileText size={14} />
                          {bag.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                        {bag.initialVolume} ml
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-sm font-medium rounded-full border border-green-100">
                          <CheckCircle2 size={16} />
                          Hoàn thành
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
