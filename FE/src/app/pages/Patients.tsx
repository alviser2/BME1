import React, { useState } from "react";
import { useNavigate } from "react-router";
import { useIVBag } from "../context/IVBagContext";
import { Search, User, Bed, Activity, Trash2, Edit2, FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { Patient } from "../types";
import { EditPatientModal } from "../components/EditPatientModal";
import { cn } from "../lib/utils";

export function Patients() {
  const navigate = useNavigate();
  const { patients, bags, deletePatient } = useIVBag();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [deletingPatient, setDeletingPatient] = useState<Patient | null>(null);

  const filteredPatients = patients.filter((p) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      `P${p.room} G${p.bed}`.toLowerCase().includes(term) ||
      p.condition?.toLowerCase().includes(term)
    );
  });

  const getPatientBagCount = (patientId: string) => {
    return bags.filter((b) => b.patientId === patientId).length;
  };

  const getActiveBagCount = (patientId: string) => {
    return bags.filter((b) => b.patientId === patientId && b.status !== "completed").length;
  };

  const handleDelete = async () => {
    if (!deletingPatient) return;
    try {
      await deletePatient(deletingPatient.id);
      toast.success(`Đã xóa bệnh nhân ${deletingPatient.name}`);
      setDeletingPatient(null);
    } catch (err) {
      toast.error("Không thể xóa bệnh nhân. Vui lòng thử lại!");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Danh sách bệnh nhân</h1>
          <p className="text-gray-500 text-sm mt-1">
            {patients.length} bệnh nhân | {patients.filter((p) => getActiveBagCount(p.id) > 0).length} đang truyền dịch
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Tìm kiếm theo tên, phòng, bệnh lý..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
        />
      </div>

      {/* Patient List */}
      {filteredPatients.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 border-dashed">
          <User size={40} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-1">
            {searchTerm ? "Không tìm thấy bệnh nhân" : "Chưa có bệnh nhân"}
          </h3>
          <p className="text-sm text-gray-400">
            {searchTerm ? "Thử thay đổi từ khóa tìm kiếm" : "Thêm bệnh nhân bằng cách gán vào thiết bị ESP32"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredPatients.map((patient) => {
            const activeCount = getActiveBagCount(patient.id);
            const totalBags = getPatientBagCount(patient.id);

            return (
              <div
                key={patient.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all cursor-pointer"
                onClick={() => navigate(`/patient/${patient.id}`)}
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-bold flex-shrink-0">
                    {patient.name.charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900 text-lg">{patient.name}</h3>
                      {activeCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          Đang truyền
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
                      <span className="flex items-center gap-2">
                        <Bed size={16} className="text-gray-400" />
                        P{patient.room} G{patient.bed}
                      </span>
                      {patient.age && (
                        <span className="flex items-center gap-2">
                          <User size={16} className="text-gray-400" />
                          {patient.age} tuổi
                        </span>
                      )}
                      {patient.condition && (
                        <span className="flex items-center gap-2">
                          <Activity size={16} className="text-gray-400" />
                          {patient.condition}
                        </span>
                      )}
                      <span className="flex items-center gap-2 text-gray-500">
                        <FileText size={16} className="text-gray-400" />
                        {totalBags} bình truyền
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setEditingPatient(patient)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Chỉnh sửa"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => setDeletingPatient(patient)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa bệnh nhân"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingPatient && (
        <EditPatientModal
          isOpen={!!editingPatient}
          onClose={() => setEditingPatient(null)}
          patient={editingPatient}
          bag={bags.find((b) => b.patientId === editingPatient.id && b.status !== "completed")}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={28} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Xóa bệnh nhân</h2>
              <p className="text-gray-600 mb-1">
                Bạn có chắc muốn xóa bệnh nhân <strong>{deletingPatient.name}</strong>?
              </p>
              <p className="text-sm text-red-500 mb-6">
                Hành động này không thể hoàn tác.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingPatient(null)}
                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
              >
                Hủy
              </button>
              <button
                onClick={handleDelete}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md transition-colors font-medium"
              >
                Xóa bệnh nhân
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
