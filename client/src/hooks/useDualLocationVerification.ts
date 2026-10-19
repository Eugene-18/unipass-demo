/**
 * 雙重定位驗證 Hook
 * 整合 GPS 和藍芽定位，提供更精確的位置驗證
 */

import { useState, useCallback } from 'react';
import { useBluetoothLocating, type BluetoothLocationResult } from './useBluetoothLocating';

export interface LocationVerificationResult {
  isValid: boolean;
  method: 'gps' | 'bluetooth' | 'dual';
  gpsDistance?: number;
  bluetoothDistance?: number;
  averageDistance?: number;
  confidence: number;
  details: string;
  error: string | null;
}

const ALLOWED_GPS_DISTANCE = 500; // GPS 允許距離 (公尺)

/**
 * 計算兩點間的距離 (Haversine 公式)
 */
function calculateGPSDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // 地球半徑 (公尺)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function useDualLocationVerification() {
  const { startScanning: startBluetoothScan } = useBluetoothLocating();
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 驗證 GPS 位置
   */
  const verifyGPSLocation = useCallback(
    async (
      userLat: number,
      userLng: number,
      eventLat: number,
      eventLng: number
    ): Promise<{ distance: number; isValid: boolean }> => {
      try {
        const distance = calculateGPSDistance(userLat, userLng, eventLat, eventLng);
        return {
          distance: Math.round(distance),
          isValid: distance <= ALLOWED_GPS_DISTANCE,
        };
      } catch (err) {
        throw new Error('GPS 距離計算失敗');
      }
    },
    []
  );

  /**
   * 驗證藍芽位置
   */
  const verifyBluetoothLocation = useCallback(async (): Promise<BluetoothLocationResult> => {
    try {
      return await startBluetoothScan();
    } catch (err) {
      throw new Error('藍芽掃描失敗');
    }
  }, [startBluetoothScan]);

  /**
   * 執行雙重定位驗證
   */
  const verifyDualLocation = useCallback(
    async (
      userLat: number,
      userLng: number,
      eventLat: number,
      eventLng: number,
      verificationMethod: 'gps' | 'bluetooth' | 'dual' = 'dual'
    ): Promise<LocationVerificationResult> => {
      setIsVerifying(true);
      setError(null);

      try {
        if (verificationMethod === 'gps') {
          // 僅使用 GPS 驗證
          const gpsResult = await verifyGPSLocation(userLat, userLng, eventLat, eventLng);
          return {
            isValid: gpsResult.isValid,
            method: 'gps',
            gpsDistance: gpsResult.distance,
            confidence: gpsResult.isValid ? 85 : 0,
            details: `GPS 距離：${gpsResult.distance} 公尺`,
            error: null,
          };
        } else if (verificationMethod === 'bluetooth') {
          // 僅使用藍芽驗證
          const btResult = await verifyBluetoothLocation();
          return {
            isValid: btResult.isValid,
            method: 'bluetooth',
            bluetoothDistance: btResult.distance,
            confidence: btResult.confidence,
            details: `藍芽距離：${btResult.distance.toFixed(1)} 公尺，信心度：${btResult.confidence}%`,
            error: btResult.error,
          };
        } else {
          // 雙重驗證 (GPS + 藍芽)
          const gpsResult = await verifyGPSLocation(userLat, userLng, eventLat, eventLng);
          const btResult = await verifyBluetoothLocation();

          // 計算平均距離
          let averageDistance = gpsResult.distance;
          if (btResult.distance > 0) {
            averageDistance = Math.round((gpsResult.distance + btResult.distance) / 2);
          }

          // 雙重驗證邏輯：GPS 和藍芽都要通過
          const isValid = gpsResult.isValid && btResult.isValid;

          // 信心度計算：GPS 35% + 藍芽 65%
          const confidence = Math.round(
            (gpsResult.isValid ? 35 : 0) + (btResult.confidence * 0.65)
          );

          return {
            isValid,
            method: 'dual',
            gpsDistance: gpsResult.distance,
            bluetoothDistance: btResult.distance,
            averageDistance,
            confidence,
            details: `GPS：${gpsResult.distance}m | 藍芽：${btResult.distance.toFixed(1)}m | 平均：${averageDistance}m`,
            error: null,
          };
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '驗證失敗';
        setError(errorMsg);
        return {
          isValid: false,
          method: verificationMethod,
          confidence: 0,
          details: '',
          error: errorMsg,
        };
      } finally {
        setIsVerifying(false);
      }
    },
    [verifyGPSLocation, verifyBluetoothLocation]
  );

  return {
    isVerifying,
    error,
    verifyGPSLocation,
    verifyBluetoothLocation,
    verifyDualLocation,
  };
}
