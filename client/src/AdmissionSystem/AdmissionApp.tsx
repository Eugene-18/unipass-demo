import { useState, useEffect, useRef } from 'react';
import type { Step, StudentInfo, Department, DocumentRequirement, ReviewStatus, PaymentMethod, AdmissionApplication, PortalUser, CandidateFieldConfig } from './types';
import StepIndicator from './components/StepIndicator';
import PersonalForm from './components/PersonalForm';
import RankingSystem from './components/RankingSystem';
import DocumentUpload from './components/DocumentUpload';
import PaymentStep from './components/PaymentStep';
import FinalConfirmation from './components/FinalConfirmation';
import DynamicForm from './components/DynamicForm';
import IdentityScoreCalculator from './components/IdentityScoreCalculator';
import PortalLoginScreen from './components/PortalLoginScreen';
import ReviewerDashboard from './components/ReviewerDashboard';
import { ChevronLeft, ChevronRight, GraduationCap, User, LogOut, LayoutPanelTop, AlertCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { ADMISSION_CHANNEL_CONFIG } from './config/admissionChannel';
import { useAdmissionGuards } from './hooks/useAdmissionRules';
import { evaluateFormula } from './lib/formulaEngine';
import { validateStudentInfo } from './lib/studentInfoValidation';
import { resolveRouteChannel, resolveSchoolTheme } from './lib/routeResolver';
import { AdmissionProvider } from './contexts/AdmissionContext';
import { clearStoredAuthToken, DEMO_AUTH_TOKEN, setStoredAuthToken } from './lib/security';

interface AdmissionAppProps {
  onBack?: () => void;
  user?: Partial<PortalUser>;
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function NTUBLogo({ size, className }: { size: number; className?: string }) {
  return (
    <div
      className={cn('flex items-center justify-center overflow-hidden bg-transparent shrink-0', className)}
      style={{ width: size, height: size, aspectRatio: '1 / 1' }}
    >
<img
        src="/ntubLOGO-GIF.gif"
        alt="國立臺北商業大學 Logo"
        className="block bg-transparent object-contain"
        style={{
          height: `${size}px`,
          width: 'auto',
          aspectRatio: '1 / 1',
          objectFit: 'contain',
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
}

function NTUBBrandLockup({ size, className, textClassName }: { size: number; className?: string; textClassName?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <NTUBLogo size={size} />
      <span className={cn('font-semibold text-slate-400 whitespace-nowrap', textClassName)}>國立臺北商業大學</span>
    </div>
  );
}

const INITIAL_DEPARTMENTS: Department[] = [...ADMISSION_CHANNEL_CONFIG.departments];

const INITIAL_DOCUMENTS: DocumentRequirement[] = ADMISSION_CHANNEL_CONFIG.candidate_fields
  .filter((field) => field.type === 'document')
  .map((field) => ({
    id: field.id,
    name: field.label,
    isRequired: field.required,
    format: field.accept ?? ['PDF'],
    status: 'missing' as const,
  }));

const APPLICATION_STORAGE_KEY = 'admission-applications';

function cloneDocumentsForReview(documents: DocumentRequirement[]): DocumentRequirement[] {
  return documents.map(({ previewUrl, ...document }) => ({ ...document }));
}

function validateRequiredCandidateFields(
  fields: CandidateFieldConfig[],
  values: Record<string, unknown>,
): Record<string, string> {
  return Object.fromEntries(
    fields
      .filter((field) => field.required && field.type !== 'document')
      .flatMap((field) => {
        const value = values[field.id];
        const isMissing = value === undefined || value === null ||
          (typeof value === 'string' && value.trim() === '');
        return isMissing ? [[field.id, `${field.label}為必填欄位`]] : [];
      }),
  );
}

function createSeedApplications(): AdmissionApplication[] {
  const now = new Date();
  const createHistory = (status: ReviewStatus, note: string, reviewerName: string) => ({
    id: `${status}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    status,
    note,
    reviewerName,
    createdAt: now.toISOString(),
  });

  return [
    {
      id: 'NTUB-20260701001',
      registrationId: 'NTUB-20260701001',
      applicantName: '林冠廷',
      email: 'student01@example.com',
      phone: '0912345678',
      admissionType: '四技',
      candidateIdentity: 'general',
      selectedDepartments: INITIAL_DEPARTMENTS.slice(0, 3),
      documents: cloneDocumentsForReview(INITIAL_DOCUMENTS),
      paymentAmount: 1500,
      paymentStatus: '已付款',
      score: 87.5,
      reviewStatus: 'under_review',
      reviewerNote: '文件齊全，待完成複核。',
      reviewerName: '系統預載',
      reviewHistory: [
        createHistory('pending', '申請資料送出，待初審。', '系統預載'),
        createHistory('under_review', '文件齊全，待完成複核。', '系統預載'),
      ],
      submittedAt: format(now, 'yyyy-MM-dd HH:mm:ss'),
      updatedAt: now.toISOString(),
    },
    {
      id: 'NTUB-20260701002',
      registrationId: 'NTUB-20260701002',
      applicantName: '陳怡伶',
      email: 'student02@example.com',
      phone: '0922333444',
      admissionType: '二技',
      candidateIdentity: 'special',
      selectedDepartments: INITIAL_DEPARTMENTS.slice(1, 4),
      documents: cloneDocumentsForReview(INITIAL_DOCUMENTS),
      paymentAmount: 1200,
      paymentStatus: '已付款',
      score: 92.1,
      reviewStatus: 'approved',
      reviewerNote: '符合錄取條件。',
      reviewerName: '系統預載',
      reviewHistory: [
        createHistory('pending', '申請資料送出，待初審。', '系統預載'),
        createHistory('approved', '符合錄取條件。', '系統預載'),
      ],
      submittedAt: format(now, 'yyyy-MM-dd HH:mm:ss'),
      updatedAt: now.toISOString(),
    },
  ];
}

function loadApplications(): AdmissionApplication[] {
  try {
    const saved = localStorage.getItem(APPLICATION_STORAGE_KEY);
    if (!saved) return createSeedApplications();

    const parsed = JSON.parse(saved) as AdmissionApplication[];
    return Array.isArray(parsed) ? parsed : createSeedApplications();
  } catch {
    return createSeedApplications();
  }
}

export default function AdmissionApp({ onBack, user: initialUser }: AdmissionAppProps) {
  const [channelConfig, setChannelConfig] = useState<ReturnType<typeof loadChannelConfig>>(() => loadChannelConfig());
  const [user, setUser] = useState<PortalUser | null>(() => initialUser ? {
    email: initialUser.email ?? '',
    name: initialUser.name ?? initialUser.email ?? '使用者',
    picture: initialUser.picture,
    role: initialUser.role === 'reviewer' ? 'reviewer' : 'candidate',
  } : null);
  const [isAuthLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>('personal');
  const [showPersonalErrors, setShowPersonalErrors] = useState(false);
  const [showCandidateFieldErrors, setShowCandidateFieldErrors] = useState(false);
  const [stepError, setStepError] = useState('');
  const [studentInfo, setStudentInfo] = useState<StudentInfo>({
    name: '',
    idNumber: '',
    email: '',
    phone: '',
    admissionType: '',
    candidateIdentity: 'general',
  });
  const [selectedDepartments, setSelectedDepartments] = useState<Department[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<Department[]>(INITIAL_DEPARTMENTS);
  const [documents, setDocuments] = useState<DocumentRequirement[]>(INITIAL_DOCUMENTS);
  const [showRequiredDocumentsWarning, setShowRequiredDocumentsWarning] = useState(false);
  const [dynamicFieldValues, setDynamicFieldValues] = useState<Record<string, unknown>>({
    special_bonus: 0,
    interview: 0,
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isScorePanelOpen, setIsScorePanelOpen] = useState(false);
  const [isPaymentComplete, setIsPaymentComplete] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'待付款' | '已付款' | '已取消'>('待付款');
  const [paymentProofs, setPaymentProofs] = useState<Array<{ id: string; url: string; fileName: string; uploadedAt: string }>>([]);
  const [registrationId, setRegistrationId] = useState('');
  const [registrationTime, setRegistrationTime] = useState('');
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [isPaymentReminderOpen, setIsPaymentReminderOpen] = useState(false);
  const [applications, setApplications] = useState<AdmissionApplication[]>(() => loadApplications());
  const previewUrlSetRef = useRef<Set<string>>(new Set());
  const scorePanelRef = useRef<HTMLDivElement | null>(null);
  const routeContext = resolveRouteChannel(window.location.pathname, channelConfig);
  const schoolTheme = resolveSchoolTheme(routeContext.schoolId);
  const guardState = useAdmissionGuards(channelConfig, selectedDepartments.length);
  const registrationPhase = channelConfig.phases.registration;
  const registrationDeadline = Date.parse(registrationPhase.end);
  const isApplicationLocked = isSubmitted || !Number.isFinite(registrationDeadline) || currentTime > registrationDeadline;
  const isApplicationLockedNow = () => isSubmitted || !Number.isFinite(registrationDeadline) || Date.now() > registrationDeadline;
  const areRequiredDocumentsComplete = documents.every((document) => !document.isRequired || document.status === 'uploaded');
  const canSubmitApplication = isPaymentComplete && areRequiredDocumentsComplete && selectedDepartments.length > 0 &&
    Object.values(validateStudentInfo(studentInfo)).every((error) => !error) &&
    Object.keys(validateRequiredCandidateFields(channelConfig.candidate_fields, dynamicFieldValues)).length === 0;
  const candidateFieldErrors = showCandidateFieldErrors
    ? validateRequiredCandidateFields(channelConfig.candidate_fields, dynamicFieldValues)
    : {};

  const scorePreview = evaluateFormula(channelConfig.score_formula, {
    ...dynamicFieldValues,
  });

  const generalFee = channelConfig.formula_variables.base_fee ?? 0;
  const specialFee = channelConfig.formula_variables.special_fee ?? generalFee;
  const extraFee = channelConfig.formula_variables.extra_fee ?? 0;
  const extraSelectionCount = Math.max(0, selectedDepartments.length - 1);
  const selectedIdentity = studentInfo.candidateIdentity || 'general';
  const identityReduction = selectedIdentity === 'special' ? Math.max(0, generalFee - specialFee) : 0;
  const paymentSummary = {
    baseFee: generalFee,
    extraFee: extraSelectionCount * extraFee,
    discount: identityReduction,
    total: Math.max(0, generalFee + extraSelectionCount * extraFee - identityReduction),
    identityLabel: selectedIdentity === 'special' ? '特別生' : '一般生',
  };

  function loadChannelConfig() {
    try {
      const saved = localStorage.getItem('admission-channel-config');
      if (!saved) return ADMISSION_CHANNEL_CONFIG;

      const parsed = JSON.parse(saved);
      const migratedRegistration =
        parsed?.phases?.registration?.end === '2026-06-30T23:59:59+08:00'
          ? {
              ...parsed.phases.registration,
              end: ADMISSION_CHANNEL_CONFIG.phases.registration.end,
            }
          : parsed?.phases?.registration;

      return {
        ...ADMISSION_CHANNEL_CONFIG,
        ...parsed,
        phases: {
          ...ADMISSION_CHANNEL_CONFIG.phases,
          ...parsed?.phases,
          registration: migratedRegistration ?? ADMISSION_CHANNEL_CONFIG.phases.registration,
        },
      } as typeof ADMISSION_CHANNEL_CONFIG;
    } catch {
      return ADMISSION_CHANNEL_CONFIG;
    }
  }

  useEffect(() => {
    if (initialUser) return;
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser) as Partial<PortalUser>;
      const restoredUser = {
        email: parsedUser.email ?? '',
        name: parsedUser.name ?? parsedUser.email ?? '使用者',
        picture: parsedUser.picture,
        role: parsedUser.role ?? 'candidate',
      };
      setUser(restoredUser);
      setStoredAuthToken(DEMO_AUTH_TOKEN);
      setStudentInfo(prev => ({
        ...prev,
        email: prev.email || restoredUser.email || '',
        name: prev.name || restoredUser.name || ''
      }));
    }
  }, [initialUser]);

  useEffect(() => {
    localStorage.setItem(APPLICATION_STORAGE_KEY, JSON.stringify(applications));
  }, [applications]);

  useEffect(() => {
    if (user?.role !== 'candidate') return;

    const submittedApplication = applications.find(
      (application) => application.email.toLowerCase() === user.email.toLowerCase() && application.submissionStatus === 'submitted'
    );
    if (!submittedApplication) return;

    setIsSubmitted(true);
    setStudentInfo({
      name: submittedApplication.applicantName,
      idNumber: studentInfo.idNumber,
      email: submittedApplication.email,
      phone: submittedApplication.phone,
      admissionType: submittedApplication.admissionType,
      candidateIdentity: submittedApplication.candidateIdentity,
    });
    setSelectedDepartments(submittedApplication.selectedDepartments);
    setDocuments(submittedApplication.documents);
    setPaymentStatus(submittedApplication.paymentStatus);
    setIsPaymentComplete(submittedApplication.paymentStatus === '已付款');
    setRegistrationId(submittedApplication.registrationId);
    setRegistrationTime(submittedApplication.submittedAt);
  }, [applications, user]);

  useEffect(() => {
    localStorage.setItem('admission-channel-config', JSON.stringify(channelConfig));
  }, [channelConfig]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(hover: none), (pointer: coarse)');
    const syncTouchDevice = () => setIsTouchDevice(mediaQuery.matches);

    syncTouchDevice();
    mediaQuery.addEventListener('change', syncTouchDevice);

    return () => mediaQuery.removeEventListener('change', syncTouchDevice);
  }, []);

  useEffect(() => {
    if (!isTouchDevice || currentStep !== 'upload' || !isScorePanelOpen) return;

    const handleOutsideClick = (event: PointerEvent) => {
      if (scorePanelRef.current && !scorePanelRef.current.contains(event.target as Node)) {
        setIsScorePanelOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [currentStep, isScorePanelOpen, isTouchDevice]);

  useEffect(() => {
    if (!routeContext.isDynamicRouteMatched) return;

    setChannelConfig((prev) => {
      if (prev.school_id === routeContext.schoolId && prev.channel_slug === routeContext.channelSlug) {
        return prev;
      }

      return {
        ...prev,
        school_id: routeContext.schoolId,
        channel_slug: routeContext.channelSlug,
      };
    });
  }, [routeContext.channelSlug, routeContext.isDynamicRouteMatched, routeContext.schoolId]);

  useEffect(() => {
    const enabledDocuments = channelConfig.candidate_fields.filter((field) => field.type === 'document');

    setDocuments((prev) => {
      const previousMap = new Map<string, DocumentRequirement>(
        prev.map((doc) => [doc.id, doc])
      );
      return enabledDocuments.map((field) => {
        const existing = previousMap.get(field.id);
        if (existing) {
          return {
            ...existing,
            name: field.label,
            isRequired: field.required,
            format: field.accept ?? existing.format,
          };
        }

        return {
          id: field.id,
          name: field.label,
          isRequired: field.required,
          format: field.accept ?? ['PDF'],
          status: 'missing' as const,
        };
      });
    });

    if (selectedDepartments.length > channelConfig.max_limit) {
      const limited = selectedDepartments.slice(0, channelConfig.max_limit);
      const removed = selectedDepartments.slice(channelConfig.max_limit);

      setSelectedDepartments(limited);
      setAvailableDepartments((prev) => [...prev, ...removed]);
    }
  }, [channelConfig, selectedDepartments]);

  useEffect(() => {
    const departmentMap = new Map(channelConfig.departments.map((department) => [department.id, department]));
    const nextSelected = selectedDepartments
      .filter((department) => departmentMap.has(department.id))
      .map((department) => departmentMap.get(department.id) ?? department);

    const selectedIds = new Set(nextSelected.map((department) => department.id));
    const nextAvailable = channelConfig.departments.filter((department) => !selectedIds.has(department.id));

    setSelectedDepartments(nextSelected);
    setAvailableDepartments(nextAvailable);
  }, [channelConfig.departments]);

  const generateRegistrationReference = () => {
    const now = new Date();
    const generatedId = `NTUB-${format(now, 'yyyyMMddHHmmss')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const generatedTime = format(now, 'yyyy-MM-dd HH:mm:ss');
    setRegistrationId(generatedId);
    setRegistrationTime(generatedTime);
    return { registrationId: generatedId, registrationTime: generatedTime };
  };

  useEffect(() => {
    if (currentStep !== 'confirm') return;
    if (!registrationId || !registrationTime) {
      generateRegistrationReference();
    }
  }, [currentStep, registrationId, registrationTime]);

  const handleLoginSuccess = (profile: PortalUser) => {
    const normalizedProfile: PortalUser = { ...profile, role: profile.role === 'reviewer' ? 'reviewer' : 'candidate' };
    setStoredAuthToken(DEMO_AUTH_TOKEN);
    setUser(normalizedProfile);
    localStorage.setItem('user', JSON.stringify(normalizedProfile));
    setStudentInfo(prev => ({
      ...prev,
      email: prev.email || normalizedProfile.email || '',
      name: prev.name || normalizedProfile.name || ''
    }));
  };

  const handleLogout = () => {
    setUser(null);
    setIsSubmitted(false);
    localStorage.removeItem('user');
    clearStoredAuthToken();
  };

  const handleNext = () => {
    if (isApplicationLockedNow()) return;

    if (currentStep === 'personal') {
      setShowPersonalErrors(true);
      setShowCandidateFieldErrors(true);
      const personalErrors = validateStudentInfo(studentInfo);
      const candidateErrors = validateRequiredCandidateFields(channelConfig.candidate_fields, dynamicFieldValues);
      if (Object.values(personalErrors).some(Boolean) || Object.keys(candidateErrors).length > 0) {
        setStepError('請檢查並修正所有必填欄位。');
        return;
      }
      setShowPersonalErrors(false);
      setShowCandidateFieldErrors(false);
      setStepError('');
      setCurrentStep('ranking');
    }
    else if (currentStep === 'ranking') {
      if (!guardState.isRegistrationOpen) {
        setStepError('目前非開放報名期間，無法繼續。');
        return;
      }
      if (selectedDepartments.length === 0) {
        setStepError('請至少選擇一個志願系所。');
        return;
      }
      setStepError('');
      setCurrentStep('upload');
    }
    else if (currentStep === 'upload') {
      const missingDocuments = documents.filter((document) => document.isRequired && document.status === 'missing');
      if (missingDocuments.length > 0) {
        setShowRequiredDocumentsWarning(true);
        return;
      }

      setShowRequiredDocumentsWarning(false);
      setStepError('');
      setCurrentStep('payment');
    }
    else if (currentStep === 'payment') {
      if (!isPaymentComplete) {
        setStepError('');
        setIsPaymentReminderOpen(true);
        return;
      }

      setStepError('');
      setCurrentStep('confirm');
    }
  };

  const handleBack = () => {
    if (isApplicationLockedNow()) return;

    setStepError('');
    if (currentStep === 'ranking') setCurrentStep('personal');
    else if (currentStep === 'upload') setCurrentStep('ranking');
    else if (currentStep === 'payment') setCurrentStep('upload');
    else if (currentStep === 'confirm') setCurrentStep('payment');
  };

  const handleUpload = (id: string, file: File) => {
    if (isApplicationLockedNow()) return;

    const nextPreviewUrl = URL.createObjectURL(file);
    previewUrlSetRef.current.add(nextPreviewUrl);

    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === id
          ? {
              ...doc,
              status: isPaymentComplete ? 'uploaded' : 'pending_payment',
              fileName: file.name,
              lastUploaded: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
              fileType: file.type || undefined,
              previewUrl: (() => {
                if (doc.previewUrl) {
                  URL.revokeObjectURL(doc.previewUrl);
                  previewUrlSetRef.current.delete(doc.previewUrl);
                }
                return nextPreviewUrl;
              })(),
            }
          : doc
      )
    );
  };

  const handleRemoveDoc = (id: string) => {
    if (isApplicationLockedNow()) return;

    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id !== id) {
          return doc;
        }

        if (doc.previewUrl) {
          URL.revokeObjectURL(doc.previewUrl);
          previewUrlSetRef.current.delete(doc.previewUrl);
        }

        return {
          ...doc,
          status: 'missing',
          fileName: undefined,
          lastUploaded: undefined,
          fileType: undefined,
          previewUrl: undefined,
        };
      })
    );
  };

  const handlePaymentComplete = () => {
    if (isApplicationLockedNow() || !paymentMethod) return;

    setIsPaymentComplete(true);
    setPaymentStatus('已付款');
    setIsPaymentReminderOpen(false);
    setDocuments((prev) => prev.map((doc) => (doc.status === 'pending_payment' ? { ...doc, status: 'uploaded' } : doc)));
  };

  useEffect(() => {
    return () => {
      previewUrlSetRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlSetRef.current.clear();
    };
  }, []);

  const handleDynamicFieldChange = (fieldId: string, value: unknown) => {
    if (isApplicationLockedNow()) return;

    setDynamicFieldValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const handleConfirm = () => {
    if (isApplicationLockedNow()) return;

    const missingDocuments = documents.filter((document) => document.isRequired && document.status !== 'uploaded');
    if (missingDocuments.length > 0) {
      setShowRequiredDocumentsWarning(true);
      setCurrentStep('upload');
      return;
    }

    const reference = registrationId && registrationTime ? { registrationId, registrationTime } : generateRegistrationReference();
    const record: AdmissionApplication = {
      id: reference.registrationId,
      registrationId: reference.registrationId,
      applicantName: studentInfo.name || '未填寫姓名',
      email: studentInfo.email || '',
      phone: studentInfo.phone || '',
      admissionType: studentInfo.admissionType || '',
      candidateIdentity: studentInfo.candidateIdentity || '',
      selectedDepartments: selectedDepartments.map((department) => ({ ...department })),
      documents: cloneDocumentsForReview(documents),
      paymentAmount: paymentSummary.total,
      paymentStatus,
      score: Number(scorePreview) || 0,
      submissionStatus: 'submitted',
      reviewStatus: 'pending',
      reviewHistory: [{
        id: `record-${reference.registrationId}`,
        status: 'pending',
        note: '申請資料送出，待初審。',
        reviewerName: '系統預載',
        createdAt: new Date().toISOString(),
      }],
      submittedAt: reference.registrationTime,
      updatedAt: new Date().toISOString(),
      paymentProof: paymentProofs,
      examNumber: null,
    };

    setApplications((prev) => {
      const existingIndex = prev.findIndex((application) => application.registrationId === record.registrationId);
      if (existingIndex === -1) {
        return [record, ...prev];
      }

      const next = [...prev];
      next[existingIndex] = { ...prev[existingIndex], ...record };
      return next;
    });
    setIsSubmitted(true);
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-bloom border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <AdmissionProvider value={{ channelConfig, setChannelConfig, applications, setApplications }}>
        <PortalLoginScreen defaultRole="candidate" onLogin={handleLoginSuccess} />
      </AdmissionProvider>
    );
  }

  if (user.role === 'reviewer') {
    return (
      <AdmissionProvider value={{ channelConfig, setChannelConfig, applications, setApplications }}>
        <ReviewerDashboard
          user={user}
          channelConfig={channelConfig}
          applications={applications}
          onApplicationsChange={setApplications}
          onConfigChange={setChannelConfig}
          onLogout={handleLogout}
        />
      </AdmissionProvider>
    );
  }

  if (isSubmitted) {
    return (
      <AdmissionProvider value={{ channelConfig, setChannelConfig, applications, setApplications }}>
        <FinalConfirmation
          studentInfo={studentInfo}
          selectedDepartments={selectedDepartments}
          paymentAmount={paymentSummary.total}
          paymentStatus={paymentStatus}
          registrationId={registrationId}
          registrationTime={registrationTime}
          isPaymentComplete={isPaymentComplete}
          canSubmit={canSubmitApplication}
          onConfirm={handleConfirm}
          isSubmitted
          onReturnHome={handleLogout}
        />
      </AdmissionProvider>
    );
  }

    return (
    <AdmissionProvider value={{ channelConfig, setChannelConfig, applications, setApplications }}>
      <div className="bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4 group cursor-pointer" onClick={() => window.location.reload()}>
            {onBack && (
              <button
                type="button"
                aria-label="返回主畫面"
                onClick={(event) => {
                  event.stopPropagation();
                  onBack();
                }}
                className="flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-bold text-indigo-bloom shadow-sm transition-colors hover:border-indigo-bloom hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-bloom/20"
              >
                <ChevronLeft size={20} />
                <span>返回主畫面</span>
              </button>
            )}
            <NTUBBrandLockup size={40} textClassName="hidden sm:inline text-sm sm:text-base font-semibold text-slate-400" />
            <div className="flex flex-col">
              <h1 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight leading-tight">
                {schoolTheme.schoolName}
              </h1>
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
                {schoolTheme.schoolNameEn}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            <div className="text-right hidden md:block">
              <div className="flex items-center gap-2 justify-end">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">招生系統在線</p>
              </div>
              <p className="text-sm font-bold text-slate-700">{studentInfo.admissionType || '115學年度招生報名'}</p>
            </div>
            
            <div className="w-px h-8 bg-slate-200 hidden sm:block" />
            
            <div className="flex items-center gap-2 sm:gap-4">
              {user ? (
                <div className="flex items-center gap-2 sm:gap-4 bg-slate-50 p-1.5 pr-2 sm:pr-4 rounded-2xl border border-slate-100">
                  {user.picture ? (
                    <img 
                      src={user.picture} 
                      alt="Avatar" 
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-white shadow-sm" 
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-bloom text-white flex items-center justify-center text-xs font-bold shadow-sm">
                      {user.name?.charAt(0)}
                    </div>
                  )}
                  <div className="text-left hidden lg:block">
                    <p className="text-xs font-bold text-slate-700 truncate max-w-[100px]">{user.name}</p>
                    <p className="text-[9px] text-slate-400 truncate max-w-[120px]">{user.email}</p>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-red-500 rounded-xl text-[10px] sm:text-xs font-bold hover:bg-red-50 hover:text-red-600 transition-all border border-slate-200 shadow-sm active:scale-95"
                  >
                    <LogOut size={14} />
                    <span className="hidden sm:inline">登出</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                  <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                    <User size={14} />
                  </div>
                  <span className="text-xs font-bold text-slate-600">訪客模式</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>


      {/* Main Content */}
      <main className="w-full px-4 sm:px-6 pt-2">
        <div className="max-w-[1200px] mx-auto w-full">
          <div className="bg-white border border-slate-200 rounded-2xl p-2 flex items-center gap-2 shadow-sm w-full">
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all bg-indigo-bloom text-white shadow-sm shadow-slate-200/40"
            >
              <LayoutPanelTop size={16} /> 報名流程
            </button>
          </div>
        </div>

        <div className="mt-3 max-w-[1200px] mx-auto w-full flex flex-col gap-4">
            <div className="shrink-0 bg-white border border-slate-200 rounded-2xl px-2 shadow-sm">
              <StepIndicator currentStep={currentStep} />
            </div>

            {isApplicationLocked && (
              <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
                🔒 報名資料已鎖定（唯讀），無法再進行修改或補件
              </div>
            )}
            {showRequiredDocumentsWarning && currentStep === 'upload' && documents.some((document) => document.isRequired && document.status === 'missing') && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                尚缺少必繳文件：{documents.filter((document) => document.isRequired && document.status === 'missing').map((document) => document.name).join('、')}
              </div>
            )}
            {stepError && currentStep !== 'personal' && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                {stepError}
              </div>
            )}

            <section className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-3 items-start">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm lg:hidden">
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500">報名期間</p>
                  <p className="mt-0.5 whitespace-nowrap text-[11px] font-bold text-slate-800">
                    {registrationPhase.start.slice(0, 10)} ~ {registrationPhase.end.slice(0, 10)}
                  </p>
                  <p className={cn(
                    "mt-0.5 truncate text-[10px] font-semibold",
                    guardState.isRegistrationOpen ? "text-green-600" : "text-amber-600"
                  )}>
                    {guardState.isRegistrationOpen ? '目前開放報名' : '尚未開放或已截止'}
                  </p>
                </div>
                <div className="shrink-0 border-l border-slate-200 pl-3">
                  <p className="whitespace-nowrap text-[10px] text-slate-500">應繳金額</p>
                  <p className={cn("mt-0.5 whitespace-nowrap text-sm font-black", isPaymentComplete ? 'text-green-600' : 'text-indigo-bloom')}>
                    NT$ {paymentSummary.total.toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                    {isPaymentComplete ? '已繳費' : '待繳費'}
                  </p>
                </div>
              </div>

              <aside className="hidden space-y-3 lg:block lg:pr-1">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <p className="text-xs text-slate-500">報名期間</p>
                  <p className="text-sm font-bold text-slate-800">
                    {registrationPhase.start.slice(0, 10)} ~ {registrationPhase.end.slice(0, 10)}
                  </p>
                  <p className={cn(
                    "text-[11px] mt-1 font-semibold",
                    guardState.isRegistrationOpen ? "text-green-600" : "text-amber-600"
                  )}>
                    {guardState.isRegistrationOpen ? '目前開放報名' : '尚未開放或已截止'}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <p className="text-xs text-slate-500">即時應繳總額</p>
                  <p className={cn("text-xl font-black", isPaymentComplete ? 'text-green-600' : 'text-indigo-bloom')}>
                    {isPaymentComplete ? '已繳費' : `NT$ ${paymentSummary.total.toLocaleString()}`}
                  </p>
                  {isPaymentComplete && (
                    <p className="mt-1 text-sm font-black text-slate-700">NT$ {paymentSummary.total.toLocaleString()}</p>
                  )}
                </div>
              </aside>

              <div className="bg-transparent">
                <div className="h-full flex flex-col">
                  <div className="h-auto overflow-visible lg:pr-1">
                    <fieldset disabled={isApplicationLocked} className="m-0 min-w-0 space-y-3 border-0 p-0 disabled:cursor-not-allowed">
                      {currentStep === 'personal' && (
                        <div className="flex flex-col lg:flex-row gap-4 items-start">
                          <div className="flex-[1.25] min-w-0 w-full">
                            <PersonalForm data={studentInfo} showErrors={showPersonalErrors} onChange={(next) => {
                              if (!isApplicationLockedNow()) setStudentInfo(next);
                            }} />
                          </div>
                          <div className="flex-1 min-w-0 w-full">
                            <DynamicForm
                              fields={channelConfig.candidate_fields.filter((field) => field.type !== 'document')}
                              values={dynamicFieldValues}
                              errors={candidateFieldErrors}
                              onChange={handleDynamicFieldChange}
                            />
                          </div>
                        </div>
                      )}
                      {currentStep === 'ranking' && (
                        <div>
                          <RankingSystem
                            selectedDepartments={selectedDepartments}
                            availableDepartments={availableDepartments}
                            maxSelections={channelConfig.max_limit}
                            isSelectionLocked={isApplicationLocked || !guardState.isRegistrationOpen}
                            onUpdate={(sel, avail) => {
                              setSelectedDepartments(sel);
                              setAvailableDepartments(avail);
                            }}
                          />
                        </div>
                      )}
                      {currentStep === 'upload' && (
                        <div className="space-y-4">
                          <DocumentUpload
                            documents={documents}
                            onUpload={handleUpload}
                            onRemove={handleRemoveDoc}
                            isLocked={isApplicationLocked}
                          />
                        </div>
                      )}
                      {currentStep === 'payment' && (
                        <PaymentStep
                          studentInfo={studentInfo}
                          selectedDepartments={selectedDepartments}
                          paymentMethod={paymentMethod}
                          paymentSummary={paymentSummary}
                          isPaymentComplete={isPaymentComplete}
                          paymentProofs={paymentProofs}
                          onPaymentProofChange={setPaymentProofs}
                          onSelectPaymentMethod={setPaymentMethod}
                          onCompletePayment={handlePaymentComplete}
                        />
                      )}
                      {currentStep === 'confirm' && (
                        <FinalConfirmation
                          studentInfo={studentInfo}
                          selectedDepartments={selectedDepartments}
                          paymentAmount={paymentSummary.total}
                          paymentStatus={paymentStatus}
                          registrationId={registrationId}
                          registrationTime={registrationTime}
                          isPaymentComplete={isPaymentComplete}
                          canSubmit={canSubmitApplication}
                          onConfirm={handleConfirm}
                        />
                      )}

                      <div className="sticky bottom-2 z-20 w-full bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-md shadow-slate-200/60">
                        <button
                          type="button"
                          onClick={handleBack}
                          disabled={isApplicationLocked || currentStep === 'personal'}
                          className={cn(
                            "flex shrink-0 items-center gap-2 px-4 sm:px-5 py-3 rounded-2xl font-bold transition-all min-h-11 whitespace-nowrap",
                            currentStep === 'personal'
                              ? "opacity-0 pointer-events-none"
                              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                          )}
                        >
                          <ChevronLeft size={20} /> 上一步
                        </button>

                        {currentStep !== 'confirm' && (
                          <button
                            type="button"
                            onClick={handleNext}
                            disabled={isApplicationLocked}
                            className={cn(
                              "flex shrink-0 select-none items-center gap-2 px-5 sm:px-7 py-3 bg-indigo-bloom text-white rounded-2xl font-bold transition-all shadow-sm shadow-slate-200/40 hover:bg-indigo-bloom/90 hover:translate-x-1 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-bloom/30 min-h-11 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-x-0"
                            )}
                          >
                            下一步 <ChevronRight size={20} />
                          </button>
                        )}
                      </div>
                    </fieldset>
                  </div>
                </div>
              </div>
            </section>
          </div>

        {/* Floating Score Card */}
        {currentStep === 'upload' && (
          <div className="fixed right-3 top-[200px] z-[1200] pointer-events-none">
            <div
              ref={scorePanelRef}
              className="relative pointer-events-auto"
              onMouseEnter={() => {
                if (!isTouchDevice) setIsScorePanelOpen(true);
              }}
              onMouseLeave={() => {
                if (!isTouchDevice) setIsScorePanelOpen(false);
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (isTouchDevice) setIsScorePanelOpen((prev) => !prev);
                }}
                className={cn(
                  'w-[60px] h-[60px] rounded-full bg-white border-2 border-indigo-bloom flex items-center justify-center text-center px-1 transition-all duration-300 ease-in-out shadow-sm shadow-slate-200/40',
                  isScorePanelOpen || !isTouchDevice ? 'opacity-100' : 'opacity-80'
                )}
                aria-label="開啟分數試算"
              >
                <span className={cn('text-base font-black leading-none', scorePreview.ok ? 'text-indigo-bloom' : 'text-red-600')}>
                  {scorePreview.ok ? (scorePreview.value ?? 0).toFixed(1) : '--'}
                </span>
              </button>

              <div
                className={cn(
                  'absolute top-0 right-16 w-60 bg-white/96 border border-slate-200 rounded-2xl p-3 shadow-sm backdrop-blur-[5px] overflow-visible z-[1300] transition-all duration-300 ease-in-out',
                  isScorePanelOpen
                    ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                    : 'opacity-0 scale-95 translate-y-1 pointer-events-none'
                )}
              >
                <IdentityScoreCalculator />
              </div>
            </div>
          </div>
        )}

        {isPaymentReminderOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/50 px-4">
            <div className="w-full max-w-md rounded-[28px] border border-indigo-bloom/20 bg-white p-6 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-bloom">
                  <AlertCircle size={22} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-bloom">繳費提醒</p>
                  <h3 className="text-xl font-black text-slate-800">請先完成繳費</h3>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                第三步的書審資料目前仍為暫存狀態，只有完成第四步繳費後，系統才會將檔案正式標示為上傳完成。
              </p>
              <button
                type="button"
                onClick={() => setIsPaymentReminderOpen(false)}
                className="mt-6 w-full rounded-2xl bg-indigo-bloom px-5 py-3.5 text-sm font-bold text-white transition-all hover:bg-indigo-bloom/90"
              >
                我知道了
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-6 border-t border-slate-200 py-6 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-4 grayscale opacity-50">
            <GraduationCap size={32} />
            <div className="text-left">
              <p className="text-sm font-bold">國立臺北商業大學</p>
              <p className="text-[10px]">National Taipei University of Business</p>
            </div>
          </div>
          <div className="text-center md:text-right space-y-1">
            <p className="text-xs text-slate-400">© 2026 國立臺北商業大學 教務處招生組 版權所有</p>
            <p className="text-xs text-slate-400">系統維護：資訊圖書處 | 聯絡電話：(02) 2322-6000</p>
          </div>
        </div>
      </footer>
      </div>
    </AdmissionProvider>
  );
}
