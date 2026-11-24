/**
 * 藍芽定位功能 Hook
 * 用於掃描附近的藍芽信標設備並計算距離
 * 支援 Bluetooth Low Energy (BLE) 標準
 */

import { useState, useCallback } from 'react';

export interface BluetoothBeacon {
  id: string;
  name: string;
  rssi: number; // 信號強度 (dBm)
  distance: number; // 計算出的距離 (公尺)
  txPower: number; // 傳輸功率 (dBm)
  accuracy: number; // 精度評分
}

export interface BluetoothLocationResult {
  isValid: boolean;
  distance: number;
  beacons: BluetoothBeacon[];
  confidence: number; // 0-100 的信心度
  error: string | null;
}

const BLUETOOTH_SCANNING_TIMEOUT = 5000; // 掃描超時 5 秒
const REFERENCE_DISTANCE = 1; // 參考距離 1 公尺
const ALLOWED_DISTANCE = 50; // 允許的最大距離 (公尺)

/**
 * 根據 RSSI 計算距離
 * 使用 Friis 傳播模型
 */
function calculateDistance(rssi: number, txPower: number = -59): number {
  if (rssi === 0) return -1;

  const ratio = rssi * 1.0 / txPower;
  if (ratio < 1.0) {
    return Math.pow(ratio, 10);
  } else {
    return 10 * Math.log10(ratio) + REFERENCE_DISTANCE;
  }
}

/**
 * 計算多個信標的平均距離
 */
function calculateAverageDistance(beacons: BluetoothBeacon[]): number {
  if (beacons.length === 0) return -1;

  const validBeacons = beacons.filter(b => b.distance > 0);
  if (validBeacons.length === 0) return -1;

  const sum = validBeacons.reduce((acc, b) => acc + b.distance, 0);
  return sum / validBeacons.length;
}

/**
 * 計算信心度 (基於信標數量和信號強度)
 */
function calculateConfidence(beacons: BluetoothBeacon[]): number {
  if (beacons.length === 0) return 0;

  // 信標數量越多，信心度越高
  const beaconCount = Math.min(beacons.length / 5, 1) * 50;

  // 信號強度越強，信心度越高
  const avgRssi = beacons.reduce((acc, b) => acc + b.rssi, 0) / beacons.length;
  const signalStrength = Math.min((avgRssi + 100) / 100, 1) * 50;

  return Math.round(beaconCount + signalStrength);
}

export function useBluetoothLocating() {
  const [isScanning, setIsScanning] = useState(false);
  const [beacons, setBeacons] = useState<BluetoothBeacon[]>([]);
  const [error, setError] = useState<string | null>(null);

  /**
   * 開始掃描藍芽信標
   */
  const startScanning = useCallback(async (): Promise<BluetoothLocationResult> => {
    setIsScanning(true);
    setError(null);
    setBeacons([]);

    try {
      // 檢查瀏覽器是否支援 Web Bluetooth API
      const bluetooth = (navigator as Navigator & { bluetooth?: unknown }).bluetooth;
      if (!bluetooth) {
        throw new Error('您的瀏覽器不支援藍芽功能');
      }

      // 模擬藍芽掃描 (實際應用需要真實的 BLE 設備)
      // 在生產環境中，應該使用 navigator.bluetooth.requestDevice()
      const mockBeacons = await simulateBluetoothScan();

      setBeacons(mockBeacons);

      const averageDistance = calculateAverageDistance(mockBeacons);
      const confidence = calculateConfidence(mockBeacons);
      const isValid = averageDistance > 0 && averageDistance <= ALLOWED_DISTANCE;

      return {
        isValid,
        distance: Math.round(averageDistance * 100) / 100,
        beacons: mockBeacons,
        confidence,
        error: null,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '藍芽掃描失敗';
      setError(errorMsg);
      return {
        isValid: false,
        distance: -1,
        beacons: [],
        confidence: 0,
        error: errorMsg,
      };
    } finally {
      setIsScanning(false);
    }
  }, []);

  /**
   * 模擬藍芽掃描 (用於演示)
   * 實際應用應該使用真實的 BLE 設備
   */
  const simulateBluetoothScan = async (): Promise<BluetoothBeacon[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // 模擬掃描到的信標
        const mockBeacons: BluetoothBeacon[] = [
          {
            id: 'beacon-001',
            name: '簽到點 A',
            rssi: -45,
            txPower: -59,
            distance: calculateDistance(-45, -59),
            accuracy: 85,
          },
          {
            id: 'beacon-002',
            name: '簽到點 B',
            rssi: -52,
            txPower: -59,
            distance: calculateDistance(-52, -59),
            accuracy: 78,
          },
          {
            id: 'beacon-003',
            name: '簽到點 C',
            rssi: -58,
            txPower: -59,
            distance: calculateDistance(-58, -59),
            accuracy: 70,
          },
        ];

        resolve(mockBeacons);
      }, BLUETOOTH_SCANNING_TIMEOUT);
    });
  };

  /**
   * 停止掃描
   */
  const stopScanning = useCallback(() => {
    setIsScanning(false);
  }, []);

  return {
    isScanning,
    beacons,
    error,
    startScanning,
    stopScanning,
  };
}
