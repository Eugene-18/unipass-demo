import { useMemo } from 'react';
import type { AdmissionChannelConfig, AdmissionStatus, PhaseDateRange } from '../types';

export function isNowWithinPhase(phase: PhaseDateRange, now: Date = new Date()): boolean {
  const start = new Date(phase.start).getTime();
  const end = new Date(phase.end).getTime();
  const nowTime = now.getTime();

  return nowTime >= start && nowTime <= end;
}

export function resolveAdmissionStatus(config: AdmissionChannelConfig, now: Date = new Date()): AdmissionStatus {
  if (isNowWithinPhase(config.phases.registration, now)) return 'registration';
  if (isNowWithinPhase(config.phases.payment, now)) return 'payment';
  if (isNowWithinPhase(config.phases.announcement, now)) return 'announcement';

  const registrationStart = new Date(config.phases.registration.start).getTime();
  return now.getTime() < registrationStart ? 'not_started' : 'closed';
}

export function checkSelectionLimit(selectedCount: number, maxLimit: number) {
  return {
    exceeded: selectedCount > maxLimit,
    canAddMore: selectedCount < maxLimit,
    remaining: Math.max(maxLimit - selectedCount, 0),
  };
}

export function useAdmissionGuards(config: AdmissionChannelConfig, selectedCount: number) {
  return useMemo(() => {
    const status = resolveAdmissionStatus(config);
    const limitState = checkSelectionLimit(selectedCount, config.max_limit);

    return {
      status,
      isRegistrationOpen: status === 'registration',
      ...limitState,
    };
  }, [config, selectedCount]);
}
