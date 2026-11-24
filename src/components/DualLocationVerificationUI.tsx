/**
 * 雙重定位驗證 UI 元件
 * 提供 GPS 和藍芽雙重驗證的使用者介面
 */

import { useState } from 'react';
import {
  MapPin,
  Bluetooth,
  CheckCircle,
  AlertCircle,
  Loader,
  Settings,
  Zap,
} from 'lucide-react';
import { useDualLocationVerification, type LocationVerificationResult } from '../hooks/useDualLocationVerification';
import { BluetoothLocationCalibration } from './BluetoothLocationCalibration';

interface DualLocationVerificationUIProps {
  userLat: number;
  userLng: number;
  eventLat: number;
  eventLng: number;
  onVerificationComplete: (result: LocationVerificationResult) => void;
  isLoading?: boolean;
}

type VerificationMethod = 'gps' | 'bluetooth' | 'dual';

export function DualLocationVerificationUI({
  userLat,
  userLng,
  eventLat,
  eventLng,
  onVerificationComplete,
  isLoading = false,
}: DualLocationVerificationUIProps) {
  const { isVerifying, verifyDualLocation } = useDualLocationVerification();
  const [result, setResult] = useState<LocationVerificationResult | null>(null);
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>('dual');
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [showBluetoothCalibration, setShowBluetoothCalibration] = useState(false);

  const handleVerify = async () => {
    const verificationResult = await verifyDualLocation(
      userLat,
      userLng,
      eventLat,
      eventLng,
      verificationMethod
    );
    setResult(verificationResult);
    onVerificationComplete(verificationResult);
  };

  const handleBluetoothCalibrationComplete = (btResult: any) => {
    setShowBluetoothCalibration(false);
    // 藍芽校正完成後，自動進行雙重驗證
    if (btResult.isValid) {
      handleVerify();
    }
  };

  const getMethodLabel = (method: VerificationMethod): string => {
    switch (method) {
      case 'gps':
        return 'GPS 定位';
      case 'bluetooth':
        return '藍芽定位';
      case 'dual':
        return '雙重驗證 (GPS + 藍芽)';
    }
  };

  const getMethodIcon = (method: VerificationMethod) => {
    switch (method) {
      case 'gps':
        return <MapPin className="w-4 h-4" />;
      case 'bluetooth':
        return <Bluetooth className="w-4 h-4" />;
      case 'dual':
        return <Zap className="w-4 h-4" />;
    }
  };

  if (showBluetoothCalibration) {
    return (
      <div className="w-full max-w-md mx-auto">
        <BluetoothLocationCalibration
          onCalibrationComplete={handleBluetoothCalibrationComplete}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border-2 border-indigo-200 shadow-lg">
      {/* 標題 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">位置驗證</h3>
          <p className="text-sm text-gray-600">選擇驗證方式進行簽到</p>
        </div>
      </div>

      {/* 驗證方式選擇 */}
      <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-bold text-gray-700">驗證方式</label>
          <button
            onClick={() => setShowMethodSelector(!showMethodSelector)}
            className="text-indigo-600 hover:text-indigo-700 font-semibold text-sm flex items-center gap-1"
          >
            <Settings className="w-4 h-4" />
            設定
          </button>
        </div>

        {showMethodSelector && (
          <div className="space-y-2 mb-4 pb-4 border-b border-gray-200">
            {(['gps', 'bluetooth', 'dual'] as VerificationMethod[]).map((method) => (
              <label
                key={method}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
              >
                <input
                  type="radio"
                  name="verification-method"
                  value={method}
                  checked={verificationMethod === method}
                  onChange={(e) => setVerificationMethod(e.target.value as VerificationMethod)}
                  className="w-4 h-4 text-indigo-600"
                />
                <div className="flex items-center gap-2">
                  {getMethodIcon(method)}
                  <span className="font-semibold text-gray-700">{getMethodLabel(method)}</span>
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
          <p className="text-sm font-semibold text-indigo-900">
            {getMethodIcon(verificationMethod)}
            {getMethodLabel(verificationMethod)}
          </p>
        </div>
      </div>

      {/* 驗證結果 */}
      {result && (
        <div className="mb-6 space-y-4">
          {/* 驗證狀態 */}
          <div
            className={`p-4 rounded-xl border-2 flex items-center gap-3 ${
              result.isValid
                ? 'bg-green-50 border-green-300'
                : 'bg-red-50 border-red-300'
            }`}
          >
            {result.isValid ? (
              <>
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-bold text-green-900">驗證成功</p>
                  <p className="text-sm text-green-700">您在允許的簽到範圍內</p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                <div>
                  <p className="font-bold text-red-900">驗證失敗</p>
                  <p className="text-sm text-red-700">您超出允許的簽到範圍</p>
                </div>
              </>
            )}
          </div>

          {/* 距離信息 */}
          <div className="grid grid-cols-2 gap-3">
            {result.gpsDistance !== undefined && (
              <div className="p-3 bg-white rounded-lg border border-gray-200">
                <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  GPS 距離
                </p>
                <p className="text-lg font-bold text-blue-600">
                  {result.gpsDistance} <span className="text-xs">公尺</span>
                </p>
              </div>
            )}
            {result.bluetoothDistance !== undefined && (
              <div className="p-3 bg-white rounded-lg border border-gray-200">
                <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                  <Bluetooth className="w-3 h-3" />
                  藍芽距離
                </p>
                <p className="text-lg font-bold text-purple-600">
                  {result.bluetoothDistance.toFixed(1)} <span className="text-xs">公尺</span>
                </p>
              </div>
            )}
          </div>

          {/* 信心度 */}
          <div className="p-3 bg-white rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">驗證信心度</p>
              <span className="text-lg font-bold text-indigo-600">{result.confidence}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${result.confidence}%` }}
              />
            </div>
          </div>

          {/* 詳細信息 */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-600 mb-1">詳細信息</p>
            <p className="text-sm font-mono text-gray-700">{result.details}</p>
          </div>

          {/* 錯誤信息 */}
          {result.error && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs text-amber-600 font-semibold">⚠️ {result.error}</p>
            </div>
          )}
        </div>
      )}

      {/* 驗證按鈕 */}
      <div className="space-y-3">
        <button
          onClick={handleVerify}
          disabled={isVerifying || isLoading}
          className={`w-full py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            isVerifying || isLoading
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl'
          }`}
        >
          {isVerifying ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              驗證中...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              開始驗證
            </>
          )}
        </button>

        {verificationMethod === 'bluetooth' && (
          <button
            onClick={() => setShowBluetoothCalibration(true)}
            disabled={isVerifying || isLoading}
            className="w-full py-2 px-4 bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Bluetooth className="w-4 h-4" />
            藍芽校正
          </button>
        )}
      </div>

      {/* 說明文字 */}
      <p className="text-xs text-gray-600 text-center mt-4">
        💡 {verificationMethod === 'dual'
          ? '雙重驗證提供最高精度的位置確認'
          : verificationMethod === 'gps'
          ? '使用 GPS 進行位置驗證'
          : '使用藍芽信標進行精確定位'}
      </p>
    </div>
  );
}
