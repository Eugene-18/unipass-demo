import type { AdmissionChannelConfig } from '../types';

export interface SchoolTheme {
  schoolName: string;
  schoolNameEn: string;
  logoText: string;
  primary: string;
  secondary: string;
}

const SCHOOL_THEME_MAP: Record<string, SchoolTheme> = {
  ntub: {
    schoolName: '國立臺北商業大學',
    schoolNameEn: 'National Taipei University of Business',
    logoText: '北商',
    primary: '#6B21A8',
    secondary: '#4C1D95',
  },
  ntust: {
    schoolName: '國立臺灣科技大學',
    schoolNameEn: 'National Taiwan University of Science and Technology',
    logoText: '台科',
    primary: '#005a9c',
    secondary: '#003560',
  },
};

export function resolveRouteChannel(pathname: string, fallback: AdmissionChannelConfig) {
  const matched = pathname.match(/^\/([^/]+)\/([^/]+)\/apply\/?$/);

  if (!matched) {
    return {
      schoolId: fallback.school_id,
      channelSlug: fallback.channel_slug,
      isDynamicRouteMatched: false,
    };
  }

  return {
    schoolId: matched[1],
    channelSlug: matched[2],
    isDynamicRouteMatched: true,
  };
}

export function resolveSchoolTheme(schoolId: string): SchoolTheme {
  return SCHOOL_THEME_MAP[schoolId] ?? {
    schoolName: schoolId.toUpperCase(),
    schoolNameEn: 'School Admission Portal',
    logoText: schoolId.slice(0, 2).toUpperCase(),
    primary: '#6B21A8',
    secondary: '#4C1D95',
  };
}
