export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  campus: '台北校區' | '桃園校區';
  quota?: number;
}

export type CandidateIdentity = 'general' | 'special';

export type PortalRole = 'candidate' | 'reviewer';

export type ReviewStatus = 'pending' | 'under_review' | 'supplement_requested' | 'pending_recheck' | 'approved' | 'rejected';

export interface ReviewHistoryItem {
  id: string;
  status: ReviewStatus;
  note: string;
  reviewerName: string;
  createdAt: string;
  type?: 'status' | 'score';
}

export interface DocumentRequirement {
  id: string;
  name: string;
  isRequired: boolean;
  format: string[];
  status: 'missing' | 'pending_payment' | 'uploaded';
  lastUploaded?: string;
  fileName?: string;
  fileType?: string;
  previewUrl?: string;
}

export interface AdmissionApplication {
  id: string;
  registrationId: string;
  applicantName: string;
  email: string;
  phone: string;
  admissionType: string;
  candidateIdentity: CandidateIdentity | '';
  selectedDepartments: Department[];
  documents: DocumentRequirement[];
  paymentAmount: number;
  paymentStatus: '待付款' | '已付款' | '已取消';
  score: number;
  scoreReviewStatus?: 'pending' | 'completed';
  submissionStatus?: 'draft' | 'submitted';
  reviewStatus: ReviewStatus;
  reviewerNote?: string;
  reviewerName?: string;
  reviewHistory?: ReviewHistoryItem[];
  submittedAt: string;
  updatedAt: string;
  // 新增繳費證明與准考證欄位
  paymentProof?: {
    id: string;
    url: string;
    fileName?: string;
    uploadedAt: string;
    verified?: boolean;
    verifiedBy?: string;
    verifiedAt?: string;
  }[];
  examNumber?: string | null;
}

export interface PortalUser {
  email: string;
  name: string;
  picture?: string;
  role: PortalRole;
}

export interface StudentInfo {
  name: string;
  idNumber: string;
  email: string;
  phone: string;
  admissionType: string;
  candidateIdentity: CandidateIdentity | '';
}

export const ADMISSION_TYPES = [
  '二技',
  '二技進修',
  '二專進修部',
  '空中進修學院',
  '四技',
  '四技進修部',
  '二技轉學',
  '四技轉學',
  '五專',
  '產業碩士專班',
  '碩士班考試入學',
  '研究所碩士班甄選入學',
  '研究所碩士在職專班',
] as const;

export type AdmissionType = typeof ADMISSION_TYPES[number];

export type Step = 'personal' | 'ranking' | 'upload' | 'payment' | 'confirm';

export type PaymentMethod = 'credit_card' | 'bank_transfer' | 'taiwan_pay' | 'cvs';

export type AdmissionStatus = 'not_started' | 'registration' | 'payment' | 'announcement' | 'closed';

export interface PhaseDateRange {
  start: string;
  end: string;
}

export type CandidateFieldType = 'score' | 'number' | 'text' | 'document';

export interface CandidateFieldConfig {
  id: string;
  label: string;
  type: CandidateFieldType;
  required: boolean;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  accept?: string[];
  helpText?: string;
}

export interface AdmissionChannelConfig {
  id: string;
  school_id: string;
  channel_slug: string;
  name: string;
  max_limit: number;
  status?: AdmissionStatus;
  phases: {
    registration: PhaseDateRange;
    payment: PhaseDateRange;
    announcement: PhaseDateRange;
  };
  candidate_fields: CandidateFieldConfig[];
  score_formula: string;
  fee_formula: string;
  formula_variables: Record<string, number>;
  departments: Department[];
}
