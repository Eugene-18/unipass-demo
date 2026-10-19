import { ADMISSION_TYPES, type StudentInfo } from '../types';

export type StudentInfoField = keyof StudentInfo;
export type StudentInfoErrors = Record<StudentInfoField, string>;

export function validateStudentInfo(data: StudentInfo): StudentInfoErrors {
  const phoneValue = data.phone.startsWith('+886') ? data.phone.slice(4) : data.phone;
  const phoneDigits = phoneValue.replace(/\D/g, '');
  const hasValidAdmissionType = ADMISSION_TYPES.some((type) => type === data.admissionType);
  const hasValidCandidateIdentity = data.candidateIdentity === 'general' || data.candidateIdentity === 'special';

  return {
    admissionType: hasValidAdmissionType ? '' : '請選擇學制',
    candidateIdentity: hasValidCandidateIdentity ? '' : '請選擇考生身分',
    name: data.name.trim() ? '' : '請輸入姓名',
    idNumber: !data.idNumber
      ? '請輸入身分證字號'
      : /^[A-Z][12]\d{8}$/.test(data.idNumber)
        ? ''
        : '格式錯誤：需為1位大寫字母 + 1或2 + 8位數字',
    email: !data.email
      ? '請輸入電子郵件'
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
        ? ''
        : '電子郵件格式不正確',
    phone: !phoneDigits
      ? '請輸入聯絡電話'
      : /^\d{8,10}$/.test(phoneDigits)
        ? ''
        : '格式錯誤：請輸入 8 到 10 碼純數字',
  };
}
