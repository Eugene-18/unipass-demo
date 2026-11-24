import React, { createContext, useContext } from 'react';
import type { AdmissionChannelConfig, AdmissionApplication } from '../types';

type AdmissionContextValue = {
  channelConfig: AdmissionChannelConfig;
  setChannelConfig: (next: AdmissionChannelConfig | ((prev: AdmissionChannelConfig) => AdmissionChannelConfig)) => void;
  applications: AdmissionApplication[];
  setApplications: (next: AdmissionApplication[] | ((prev: AdmissionApplication[]) => AdmissionApplication[])) => void;
};

const AdmissionContext = createContext<AdmissionContextValue | null>(null);

export function AdmissionProvider({ value, children }: { value: AdmissionContextValue; children: React.ReactNode }) {
  return <AdmissionContext.Provider value={value}>{children}</AdmissionContext.Provider>;
}

export function useAdmissionContext() {
  const ctx = useContext(AdmissionContext);
  if (!ctx) throw new Error('useAdmissionContext must be used within AdmissionProvider');
  return ctx;
}

export default AdmissionContext;
