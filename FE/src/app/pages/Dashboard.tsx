import React, { useState, useMemo } from "react";
import { useIVBag } from "../context/IVBagContext";
import { BagCard } from "../components/BagCard";
import { AddBagModal } from "../components/AddBagModal";
import { Search, Plus, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { calculateTimeRemainingInMinutes } from "../lib/utils";

type SortOption = "timeAsc" | "timeDesc" | "volAsc" | "volDesc";

export function Dashboard() {
  const { bags, patients } = useIVBag();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("timeAsc");

  const activeBags = bags.filter((b) => b.status !== "completed");

  const filteredAndSortedBags = useMemo(() => {
    let result = activeBags;

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter((bag) => {
        const patient = patients.find((p) => p.id === bag.patientId);
        return patient?.name.toLowerCase().includes(lowerTerm) || patient?.roomBed.toLowerCase().includes(lowerTerm);
      });
    }

    result.sort((a, b) => {
      const timeA = calculateTimeRemainingInMinutes(a.currentVolume, a.flowRate);
      const timeB = calculateTimeRemainingInMinutes(b.currentVolume, b.flowRate);

      switch (sortBy) {
        case "timeAsc":
          return timeA - timeB;
        case "timeDesc":
          return timeB - timeA;
        case "volAsc":
          return a.currentVolume - b.currentVolume;
        case "volDesc":
          return b.currentVolume - a.currentVolume;
        default:
          return 0;
      }
    });

    return result;
  }, [activeBags, patients, searchTerm, sortBy]);

  const warningCount = activeBags.filter(
    (b) => b.status !== "empty" && (b.currentVolume <= 50 || calculateTimeRemainingInMinutes(b.currentVolume, b.flowRate) <= 15)
  ).length;

  const emptyCount = activeBags.filter((b) => b.status === "empty").length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tổng Quan</h1>
          <p className="text-gray-500 text-sm mt-1">Đang theo dõi {activeBags.length} bình truyền</p>
        </div>
        
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-all shadow-blue-600/20 font-medium"
        >
          <Plus size={20} />
          <span>Thêm bình truyền</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <SlidersHorizontal size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Đang hoạt động</p>
            <p className="text-2xl font-bold text-gray-900">{activeBags.length - emptyCount}</p>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-2xl border border-orange-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
            <ArrowUpDown size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Sắp hết ({`<`} 15p)</p>
            <p className="text-2xl font-bold text-orange-500">{warningCount}</p>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
             <div className="relative">
                <div className="w-3 h-3 rounded-full bg-red-500 absolute -top-1 -right-1 animate-ping"></div>
                <div className="w-3 h-3 rounded-full bg-red-500 absolute -top-1 -right-1"></div>
             </div>
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Đã hết dịch</p>
            <p className="text-2xl font-bold text-red-500">{emptyCount}</p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Tìm kiếm bệnh nhân, phòng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <span className="text-sm text-gray-500 whitespace-nowrap">Sắp xếp theo:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none font-medium text-sm text-gray-700 flex-1 cursor-pointer"
          >
            <option value="timeAsc">Thời gian ít nhất</option>
            <option value="timeDesc">Thời gian nhiều nhất</option>
            <option value="volAsc">Thể tích ít nhất</option>
            <option value="volDesc">Thể tích nhiều nhất</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {filteredAndSortedBags.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 border-dashed">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
            <Search size={32} />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">Không tìm thấy kết quả</h3>
          <p className="text-gray-500 max-w-sm mx-auto">Thử thay đổi từ khóa tìm kiếm hoặc thêm bệnh nhân mới để bắt đầu theo dõi.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAndSortedBags.map((bag) => {
            const patient = patients.find((p) => p.id === bag.patientId);
            if (!patient) return null;
            return <BagCard key={bag.id} bag={bag} patient={patient} />;
          })}
        </div>
      )}

      <AddBagModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
