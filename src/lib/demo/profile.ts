import type { Experience, Profile, Skill, SocialLink } from '@/types/content';

const timestamp = '2026-09-01T00:00:00Z';

export const demoProfile: Profile = {
  id: 1,
  name_zh: '冼冠宇',
  name_en: 'Kuan-Yu Hsien',
  headline_zh: 'Software Engineer',
  headline_en: 'Software Engineer',
  bio_zh: '我做能被量測的系統。',
  bio_en: 'I build systems whose impact can be measured.',
  now_zh: 'CS undergrad · Looking for 2027 new-grad roles',
  now_en: 'CS undergrad · Looking for 2027 new-grad roles',
  location_zh: 'Taiwan',
  location_en: 'Taiwan',
  email: 'hi@example.com',
  avatar_url: '/demo/portrait-cut.png',
  resume_zh_url: '/resumes/kuan-yu-hsien-resume-zh.pdf',
  resume_en_url: '/resumes/kuan-yu-hsien-resume-en.pdf',
  resume_updated_at: '2026-04-30T00:00:00Z',
  seo_description_zh: '',
  seo_description_en: '',
  updated_at: timestamp,
};

export const demoSocial: SocialLink[] = [
  { id: '50000000-0000-4000-8000-000000000001', platform: 'linkedin', label: 'LinkedIn', url: 'https://linkedin.com/in/', sort_order: 2, is_visible: true, created_at: timestamp },
  { id: '50000000-0000-4000-8000-000000000002', platform: 'github', label: 'GitHub', url: 'https://github.com/', sort_order: 3, is_visible: true, created_at: timestamp },
  // Sample contact channels so the contact page layout can be previewed in demo mode.
  { id: '50000000-0000-4000-8000-000000000003', platform: 'phone', label: '', url: 'tel:+886 0900000000', sort_order: 4, is_visible: true, created_at: timestamp },
  { id: '50000000-0000-4000-8000-000000000004', platform: 'line', label: 'LINE', url: 'https://line.me/ti/p/~sample-id', sort_order: 5, is_visible: true, created_at: timestamp },
  { id: '50000000-0000-4000-8000-000000000005', platform: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/sample.account', sort_order: 6, is_visible: true, created_at: timestamp },
];

export const demoExperiences: Experience[] = [{
  id: '10000000-0000-4000-8000-000000000001',
  kind: 'education',
  org_zh: '資訊科學系',
  org_en: 'Computer Science',
  role_zh: '學士班',
  role_en: 'Undergraduate',
  description_zh: '透過專案實作，學習系統設計、資料處理與軟體工程。',
  description_en: 'Learning system design, data processing and software engineering through projects.',
  start_date: '2023-09-01',
  end_date: null,
  is_current: true,
  url: null,
  logo_url: null,
  sort_order: 0,
  is_visible: true,
  created_at: timestamp,
  updated_at: timestamp,
}];

// Skills are no longer rendered on the site; kept for scripts/generate-seed.ts.
const categories = [
  ['語言', 'Languages', ['TypeScript', 'Python', 'SQL']],
  ['前端', 'Frontend', ['React', 'Next.js', 'Tailwind CSS']],
  ['資料與 AI', 'Data & AI', ['PostgreSQL', 'pandas', 'PyTorch']],
  ['基礎設施', 'Infrastructure', ['Docker', 'Git', 'Supabase']],
] as const;

export const demoSkills: Skill[] = categories.flatMap(([zh, en, names], category) =>
  names.map((name, index) => ({
    id: `20000000-0000-4000-8000-${String(category * 10 + index).padStart(12, '0')}`,
    category_zh: zh,
    category_en: en,
    category_order: category,
    name,
    sort_order: index,
    is_visible: true,
    created_at: timestamp,
  })));
