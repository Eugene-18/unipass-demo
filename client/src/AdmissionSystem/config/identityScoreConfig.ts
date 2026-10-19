export type CandidateIdentity = 'general' | 'special';

export interface IdentityFormulaConfig {
  id: CandidateIdentity;
  label: string;
  variables: string[];
  formula: string;
}

export interface IdentityScoreConfig {
  identities: IdentityFormulaConfig[];
}

export const IDENTITY_SCORE_CONFIG: IdentityScoreConfig = {
  identities: [
    {
      id: 'general',
      label: '一般生',
      variables: ['chinese', 'english', 'document', 'interview'],
      formula:
        '((chinese * 1 + english * 1.5) / 2.5) * 0.35 + document * 0.3 + interview * 0.35',
    },
    {
      id: 'special',
      label: '特種生',
      variables: ['chinese', 'english', 'document', 'interview', 'special_bonus'],
      formula:
        '(((chinese * 1 + english * 1.5) / 2.5) * 0.35 + document * 0.3 + interview * 0.35) * (1 + special_bonus)',
    },
  ],
};
