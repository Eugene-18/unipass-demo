import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

// 註冊 Chart.js 元件
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

// 1. 介面新增 title 屬性來接收真實活動名稱
interface Recommendation {
  activityId: number;
  title: string;
  matchRate: number;
}

export const RecommendationDashboard: React.FC<{ studentId: number }> = ({ studentId }) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const response = await fetch(`http://localhost:3000/api/recommendations/activities?studentId=${studentId}`);
        const result = await response.json();
        if (result.success) {
          setRecommendations(result.data);
        }
      } catch (error) {
        console.error('取得活動推薦資料失敗:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [studentId]);

  if (loading) return <div className="text-center p-4">AI 正在計算最適合你的校園活動...</div>;
  if (recommendations.length === 0) return <div className="text-center p-4">目前沒有足夠的數據來進行推薦喔！</div>;

  // 雷達圖的假資料維度 (維持你的能力特質不變)
  const chartData = {
    labels: ['程式邏輯', '商業企劃', '團隊溝通', '美感設計', '數據分析'],
    datasets: [
      {
        label: '你的能力雷達圖',
        data: [85, 90, 60, 40, 75],
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2,
      },
    ],
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow-lg rounded-xl">
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
        AI 專屬校園活動推薦
      </h2>
      
      <div className="flex flex-col md:flex-row gap-8 items-center">
        {/* 左側：雷達圖維持不變 */}
        <div className="w-full md:w-1/2">
          <Radar data={chartData} />
        </div>

        {/* 右側：顯示真實活動名稱 */}
        <div className="w-full md:w-1/2">
          <h3 className="text-lg font-semibold mb-4 text-blue-600">為你推薦的專屬活動 Top 5：</h3>
          <ul className="space-y-4">
            {recommendations.map((rec, index) => (
              <li key={index} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-100 hover:shadow-md transition">
                <div>
                  {/* 這裡已經替換成直接顯示資料庫撈出來的 rec.title */}
                  <span className="font-bold text-gray-700 text-lg">
                    {rec.title}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <div className="text-xl font-bold text-blue-500">
                    {rec.matchRate}% 契合
                  </div>
                  <button className="mt-2 px-3 py-1 bg-blue-100 text-blue-600 text-sm font-semibold rounded-lg hover:bg-blue-200 transition">
                    查看詳情
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};