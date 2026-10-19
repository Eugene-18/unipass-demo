const blockedTerms = [
  'password', 'passw0rd', 'qwerty', 'letmein', 'welcome', 'admin',
  'student', 'teacher', 'university', 'school', 'birthday', 'sunshine',
  'dragon', 'monkey', 'football', 'iloveyou', 'ntub', 'cyut', 'car',
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizePersonalInfo(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function containsSequence(password: string): boolean {
  const value = password.toLowerCase();
  let ascending = 1;
  let descending = 1;

  for (let index = 1; index < value.length; index += 1) {
    const previous = value.charCodeAt(index - 1);
    const current = value.charCodeAt(index);
    const sameCharacterType =
      (previous >= 48 && previous <= 57 && current >= 48 && current <= 57)
      || (previous >= 97 && previous <= 122 && current >= 97 && current <= 122);

    ascending = sameCharacterType && current === previous + 1 ? ascending + 1 : 1;
    descending = sameCharacterType && current === previous - 1 ? descending + 1 : 1;
    if (ascending >= 3 || descending >= 3) return true;
  }

  return false;
}

export function validatePassword(
  password: string,
  personalInfo: Array<string | null | undefined> = [],
): string | null {
  if (Array.from(password).length < 8) return '密碼至少需要 8 個字元。';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) return '密碼須同時包含大小寫英文字母。';
  if (!/[0-9]/.test(password)) return '密碼須包含數字。';
  if (!/[^\p{L}\p{N}\s]/u.test(password)) return '密碼須包含至少一個符號。';
  if (/(.)\1{2,}/u.test(password)) return '密碼不可包含連續重複三次以上的字元。';
  if (/^(.{2,3})\1+$/u.test(password)) return '密碼不可重複使用相同的字元組合。';
  if (containsSequence(password)) return '密碼不可包含連續字元或數字，例如 abc 或 123。';

  const rawNormalizedPassword = normalize(password);
  const normalizedPassword = normalize(password.toLowerCase().replace(/[014578@!$+]/g, (character) => ({
    '0': 'o', '1': 'i', '4': 'a', '5': 's', '7': 't', '8': 'b',
    '@': 'a', '!': 'i', '$': 's', '+': 't',
  }[character] || character)));
  if (blockedTerms.some(term => normalizedPassword.includes(normalize(term)))) {
    return '密碼不可使用常見單字、弱密碼或機關縮寫，例如 car、CYUT、NTUB。';
  }

  const normalizedPersonalInfo = personalInfo
    .filter((value): value is string => Boolean(value))
    .flatMap(value => {
      const normalized = normalizePersonalInfo(value);
      const emailName = normalize(value.split('@')[0]);
      const digits = value.replace(/\D/g, '');
      const dateParts = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
      return [
        normalized.length >= 3 ? normalized : '',
        emailName.length >= 3 ? emailName : '',
        digits.length >= 4 ? digits : '',
        ...(dateParts ? [dateParts[1], `${dateParts[2].padStart(2, '0')}${dateParts[3].padStart(2, '0')}`] : []),
      ];
    })
    .filter(Boolean);
  if (normalizedPersonalInfo.some(value => rawNormalizedPassword.includes(value) || normalizedPassword.includes(value))) {
    return '密碼不可包含帳號、姓名、生日或電話等個人資料。';
  }

  return null;
}
