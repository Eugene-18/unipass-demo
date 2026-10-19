/**
 * 藍芽定位校正元件
 * 提供視覺化的藍芽信標掃描和距離校正介面
 */

import { useState } from 'react';
import { Bluetooth, Radio, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { useBluetoothLocating, type BluetoothLocationResult } from '../hooks/useBluetoothLocating';

interface BluetoothLocationCalibrationProps {
  onCalibrationComplete: (result: BluetoothLocationResult) => void;
  allowedDistance?: number;
  isLoading?: boolean;
}

export function BluetoothLocationCalibration({
  onCalibrationComplete,
  allowedDistance = 50,
  isLoading = false,
}: BluetoothLocationCalibrationProps) {
  const { isScanning, beacons, error, startScanning } = useBluetoothLocating();
  const [result, setResult] = useState<BluetoothLocationResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleStartCalibration = async () => {
    const calibrationResult = await startScanning();
    setResult(calibrationResult);
    onCalibrationComplete(calibrationResult);
  };

  const getSignalStrengthColor = (rssi: number): string => {
    if (rssi > -50) return 'bg-green-100 text-green-700';
    if (rssi > -70) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const getSignalStrengthLabel = (rssi: number): string => {
    if (rssi > -50) return '非常強';
    if (rssi > -70) return '中等';
    return '較弱';
  };

  const getDistanceStatusColor = (distance: number): string => {
    if (distance <= allowedDistance * 0.3) return 'text-green-600';
    if (distance <= allowedDistance * 0.7) return 'text-yellow-600';
    if (distance <= allowedDistance) return 'text-orange-600';
    return 'text-red-600';
  };

  const getDistanceStatusLabel = (distance: number): string => {
    if (distance <= allowedDistance * 0.3) return '非常接近';
    if (distance <= allowedDistance * 0.7) return '接近';
    if (distance <= allowedDistance) return '邊界';
    return '超出範圍';
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 shadow-lg">
      {/* 標題 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
          <Bluetooth className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">藍芽定位校正</h3>
          <p className="text-sm text-gray-600">掃描附近的藍芽信標設備</p>
        </div>
      </div>

      {/* 掃描狀態 */}
      {isScanning && (
        <div className="mb-6 p-4 bg-blue-100 border border-blue-300 rounded-xl flex items-center gap-3">
          <Loader className="w-5 h-5 text-blue-600 animate-spin" />
          <div>
            <p className="font-semibold text-blue-900">正在掃描藍芽信標...</p>
            <p className="text-sm text-blue-700">請稍候 5 秒</p>
          </div>
        </div>
      )}

      {/* 錯誤提示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">掃描失敗</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* 掃描結果 */}
      {result && (
        <div className="mb-6 space-y-4">
          {/* 距離顯示 */}
          <div className="p-4 bg-white rounded-xl border border-gray-200">
            <p className="text-sm text-gray-600 mb-2">計算距離</p>
            <div className={`text-4xl font-bold ${getDistanceStatusColor(result.distance)}`}>
              {result.distance > 0 ? result.distance.toFixed(1) : '--'} <span className="text-lg">公尺</span>
            </div>
            <p className={`text-sm font-semibold mt-2 ${getDistanceStatusColor(result.distance)}`}>
              {getDistanceStatusLabel(result.distance)}
            </p>
          </div>

          {/* 驗證結果 */}
          <div className={`p-4 rounded-xl border-2 flex items-center gap-3 ${
            result.isValid
              ? 'bg-green-50 border-green-300'
              : 'bg-red-50 border-red-300'
          }`}>
            {result.isValid ? (
              <>
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-bold text-green-900">位置驗證成功</p>
                  <p className="text-sm text-green-700">您在允許的簽到範圍內</p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="w-6 h-6 text-red-600" />
                <div>
                  <p className="font-bold text-red-900">位置驗證失敗</p>
                  <p className="text-sm text-red-700">您超出允許的簽到範圍</p>
                </div>
              </>
            )}
          </div>

          {/* 信心度 */}
          <div className="p-4 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">定位信心度</p>
              <span className="text-lg font-bold text-indigo-600">{result.confidence}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${result.confidence}%` }}
              />
            </div>
          </div>

          {/* 詳細信息按鈕 */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Radio className="w-4 h-4" />
            {showDetails ? '隱藏' : '顯示'}詳細信息
          </button>
        </div>
      )}

      {/* 詳細信標信息 */}
      {showDetails && beacons.length > 0 && (
        <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200">
          <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Radio className="w-4 h-4" />
            掃描到的信標 ({beacons.length})
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {beacons.map((beacon, idx) => (
              <div key={beacon.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">#{idx + 1} {beacon.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{beacon.id}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${getSignalStrengthColor(beacon.rssi)}`}>
                    {getSignalStrengthLabel(beacon.rssi)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-blue-50 p-2 rounded">
                    <p className="text-gray-600">RSSI</p>
                    <p className="font-mono font-bold text-blue-600">{beacon.rssi} dBm</p>
                  </div>
                  <div className="bg-green-50 p-2 rounded">
                    <p className="text-gray-600">距離</p>
                    <p className="font-mono font-bold text-green-600">{beacon.distance.toFixed(1)}m</p>
                  </div>
                  <div className="bg-purple-50 p-2 rounded">
                    <p className="text-gray-600">精度</p>
                    <p className="font-mono font-bold text-purple-600">{beacon.accuracy}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 掃描按鈕 */}
      <button
        onClick={handleStartCalibration}
        disabled={isScanning || isLoading}
        className={`w-full py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
          isScanning || isLoading
            ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
        }`}
      >
        {isScanning ? (
          <>
            <Loader className="w-5 h-5 animate-spin" />
            掃描中...
          </>
        ) : (
          <>
            <Bluetooth className="w-5 h-5" />
            開始藍芽掃描
          </>
        )}
      </button>

      {/* 說明文字 */}
      <p className="text-xs text-gray-600 text-center mt-4">
        💡 請確保您的裝置已開啟藍芽，並位於簽到點附近
      </p>
    </div>
  );
}
