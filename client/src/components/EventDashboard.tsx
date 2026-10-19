import { useEffect, useState } from 'react';

type DashboardData = {
  feedbacksList?: { rating: number; text: string }[];
  registrationRate: number;
  attendanceRate: number;
  averageRating: number;
  totalRegistered: number;
  totalCheckedIn: number;
  totalCapacity: number;
  feedbackCount: number;
};

export default function EventDashboard({ eventId }: { eventId: number }) {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/events/${eventId}/dashboard`);
        const result = await res.json();
        if (result.success) {
          setData(result.data);
        }
      } catch (err) {
        console.error('無法載入儀表板:', err);
      }
    };

    fetchDashboardData();
    // 設定每 5 秒自動更新一次數據 (即時戰情室概念)
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, [eventId]);

  if (!data) return <div className="text-gray-500 animate-pulse p-4">📊 載入戰情室數據中...</div>;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6">
        {/* 報名率卡片 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
          <h3 className="text-gray-500 font-medium mb-2">活動報名率</h3>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-4xl font-bold text-blue-600">{data.registrationRate}</span>
            <span className="text-xl text-blue-600">%</span>
          </div>
          <p className="text-sm text-gray-400 mt-2">
            已報名 {data.totalRegistered} / 總名額 {data.totalCapacity}
          </p>
        </div>

        {/* 到場率卡片 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
          <h3 className="text-gray-500 font-medium mb-2">實際到場率</h3>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-4xl font-bold text-emerald-500">{data.attendanceRate}</span>
            <span className="text-xl text-emerald-500">%</span>
          </div>
          <p className="text-sm text-gray-400 mt-2">
            已簽到 {data.totalCheckedIn} / 已報名 {data.totalRegistered}
          </p>
        </div>

        {/* 滿意度卡片 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-amber-100 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
          <h3 className="text-gray-500 font-medium mb-2">綜合滿意度</h3>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-4xl font-bold text-amber-500">{data.averageRating > 0 ? data.averageRating : '--'}</span>
            <span className="text-xl text-gray-400">/ 5.0</span>
          </div>
          <p className="text-sm text-gray-400 mt-2">
            共 {data.feedbackCount} 筆問卷回饋
          </p>
        </div>
      </div>

      {/* 👇 這是全新加入的「學生留言板」區塊 */}
      {data.feedbacksList && data.feedbacksList.length > 0 && (
        <div className="mt-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-fade-in">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            📝 學生回饋與留言
          </h3>
          <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            {data.feedbacksList.map((fb, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-amber-400 text-lg">
                    {"★".repeat(fb.rating)}{"☆".repeat(5 - fb.rating)}
                  </span>
                  <span className="text-sm text-gray-500 font-medium">{fb.rating} 顆星</span>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">{fb.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
