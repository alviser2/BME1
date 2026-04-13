import React, { useState } from "react";
import { useIVBag } from "../context/IVBagContext";
import { X, Cpu, User, Wifi } from "lucide-react";
import { toast } from "sonner";

interface AddBagModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BAG_TYPES = [
  "Nước muối sinh lý 0.9%",
  "Glucose 5%",
  "Glucose 10%",
  "Ringer Lactate",
  "Amino Acid",
  "Lipid 20%",
  "Khác",
];

export function AddBagModal({ isOpen, onClose }: AddBagModalProps) {
  const { patients, esp32Devices, addPatient, addBag, refreshData } = useIVBag();

  // --- Bệnh nhân ---
  const [selectedPatient, setSelectedPatient] = useState("new");
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState("");
  const [condition, setCondition] = useState("");
  const [room, setRoom] = useState("");
  const [bed, setBed] = useState("");

  // --- Dịch truyền ---
  const [bagType, setBagType] = useState(BAG_TYPES[0]);
  const [customBagType, setCustomBagType] = useState("");
  const [initialVolume, setInitialVolume] = useState("500");
  const [flowRate, setFlowRate] = useState("40");

  // --- ESP32 ---
  const [selectedEsp32, setSelectedEsp32] = useState("none");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ESP32 đang online (chưa gắn bag nào, không bảo trì)
  const availableEsp32 = esp32Devices.filter(
    (d) => !d.maintenance && !d.patientId && (d.status === "online" || !d.status)
  );

  if (!isOpen) return null;

  const handleClose = () => {
    // Reset toàn bộ
    setSelectedPatient("new");
    setPatientName("");
    setAge("");
    setCondition("");
    setRoom("");
    setBed("");
    setBagType(BAG_TYPES[0]);
    setCustomBagType("");
    setInitialVolume("500");
    setFlowRate("40");
    setSelectedEsp32("none");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // ── 1. Xử lý bệnh nhân ──
      let pId = selectedPatient;

      if (selectedPatient === "new") {
        if (!patientName.trim()) {
          toast.error("Vui lòng nhập họ tên bệnh nhân");
          return;
        }
        if (!room.trim() || !bed.trim()) {
          toast.error("Vui lòng nhập phòng và số giường");
          return;
        }
        try {
          pId = await addPatient({
            name: patientName.trim(),
            room: room.trim(),
            bed: bed.trim(),
            age: age ? parseInt(age, 10) : undefined,
            condition: condition.trim() || undefined,
          });
          await refreshData();
        } catch (err) {
          toast.error("Lỗi khi tạo bệnh nhân: " + (err as Error).message);
          return;
        }
      }

      // ── 2. Xử lý loại dịch ──
      const finalBagType = bagType === "Khác" ? customBagType.trim() : bagType;
      if (bagType === "Khác" && !customBagType.trim()) {
        toast.error("Vui lòng nhập tên loại dịch");
        return;
      }

      // ── 3. Validate số ──
      const vol = Number(initialVolume);
      const fr = Number(flowRate);
      if (!vol || vol < 50) {
        toast.error("Thể tích phải ít nhất 50ml");
        return;
      }
      if (!fr || fr < 5) {
        toast.error("Tốc độ truyền phải ít nhất 5 giọt/phút");
        return;
      }

      // ── 4. Tạo bag ──
      await addBag({
        patientId: pId,
        esp32Id: selectedEsp32 !== "none" ? selectedEsp32 : undefined,
        type: finalBagType,
        initialVolume: vol,
        currentVolume: vol,
        flowRate: fr,
      });

      await refreshData();
      toast.success("Đã thêm bình truyền thành công");
      handleClose();
    } catch (error) {
      toast.error("Lỗi: " + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative animate-in fade-in zoom-in duration-200 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-900">Thêm Bình Truyền Mới</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">

          {/* ── SECTION: Bệnh nhân ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <User size={13} />
              </div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Bệnh Nhân
              </h3>
            </div>

            {/* Chọn bệnh nhân có sẵn hoặc tạo mới */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chọn bệnh nhân
                </label>
                <select
                  value={selectedPatient}
                  onChange={(e) => setSelectedPatient(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-sm"
                >
                  <option value="new">+ Tạo bệnh nhân mới</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — P{p.room} G{p.bed}
                      {p.age ? ` (${p.age} tuổi)` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Form bệnh nhân mới */}
              {selectedPatient === "new" && (
                <div className="bg-blue-50/60 rounded-xl p-4 space-y-3 border border-blue-100">
                  {/* Họ tên */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Họ và tên <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                      placeholder="Nguyễn Văn A"
                    />
                  </div>

                  {/* Tuổi + Phòng + Giường */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Tuổi</label>
                      <input
                        type="number"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                        placeholder="45"
                        min="0"
                        max="120"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Phòng <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={room}
                        onChange={(e) => setRoom(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                        placeholder="101"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Giường <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={bed}
                        onChange={(e) => setBed(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                        placeholder="A1"
                      />
                    </div>
                  </div>

                  {/* Bệnh lý */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Bệnh lý / Tình trạng
                    </label>
                    <input
                      type="text"
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                      placeholder="VD: Sốt xuất huyết, Hậu phẫu..."
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── SECTION: Thiết bị ESP32 ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                <Cpu size={13} />
              </div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Thiết Bị ESP32
              </h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gắn thiết bị ESP32
                <span className="text-gray-400 font-normal ml-1">(không bắt buộc)</span>
              </label>

              {availableEsp32.length === 0 ? (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500">
                  <Wifi size={15} className="text-gray-400" />
                  Không có ESP32 nào đang rảnh (online)
                </div>
              ) : (
                <select
                  value={selectedEsp32}
                  onChange={(e) => setSelectedEsp32(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-sm"
                >
                  <option value="none">— Không gắn ESP32 (theo dõi thủ công) —</option>
                  {availableEsp32.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.id}
                    </option>
                  ))}
                </select>
              )}

              {selectedEsp32 !== "none" && (
                <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                  Thiết bị sẽ tự động ghi nhận thể tích mỗi 5 giây
                </p>
              )}
              {selectedEsp32 === "none" && (
                <p className="mt-1.5 text-xs text-gray-400">
                  Không có ESP32 → hệ thống tự tính thể tích dựa theo tốc độ truyền
                </p>
              )}
            </div>
          </section>

          {/* ── SECTION: Thông tin dịch truyền ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">
                💧
              </div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Thông Tin Dịch Truyền
              </h3>
            </div>

            <div className="space-y-3">
              {/* Loại dịch */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loại dịch <span className="text-red-500">*</span>
                </label>
                <select
                  value={bagType}
                  onChange={(e) => setBagType(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-sm"
                >
                  {BAG_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {bagType === "Khác" && (
                  <input
                    type="text"
                    value={customBagType}
                    onChange={(e) => setCustomBagType(e.target.value)}
                    className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="Nhập tên loại dịch..."
                  />
                )}
              </div>

              {/* Thể tích + Tốc độ */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Thể tích ban đầu <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={initialVolume}
                      onChange={(e) => setInitialVolume(e.target.value)}
                      className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      min="50"
                      max="5000"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">ml</span>
                  </div>
                  {/* Quick presets */}
                  <div className="flex gap-1 mt-1.5">
                    {[250, 500, 1000].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setInitialVolume(String(v))}
                        className={`text-xs px-2 py-0.5 rounded-md transition-colors ${
                          initialVolume === String(v)
                            ? "bg-blue-100 text-blue-700 font-medium"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {v}ml
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tốc độ truyền <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={flowRate}
                      onChange={(e) => setFlowRate(e.target.value)}
                      className="w-full px-3 py-2.5 pr-16 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      min="5"
                      max="300"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 whitespace-nowrap">
                      giọt/p
                    </span>
                  </div>
                  {/* Quick presets */}
                  <div className="flex gap-1 mt-1.5">
                    {[20, 40, 60].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setFlowRate(String(v))}
                        className={`text-xs px-2 py-0.5 rounded-md transition-colors ${
                          flowRate === String(v)
                            ? "bg-blue-100 text-blue-700 font-medium"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Actions ── */}
          <div className="pt-2 flex justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors font-medium text-sm"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl shadow-sm transition-colors font-medium text-sm"
            >
              {isSubmitting ? "Đang lưu..." : "Lưu & Bắt đầu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
