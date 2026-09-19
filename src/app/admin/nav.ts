export const adminNavLinks = [
  { href: '/admin', label: '首頁', hint: '總覽' },
  { href: '/admin/profile', label: '個人資料', hint: '姓名、簡介、聯絡方式' },
  { href: '/admin/experiences', label: '經歷', hint: '工作、學歷、獲獎' },
  { href: '/admin/social', label: '社群連結', hint: '首頁與聯絡頁的連結' },
  { href: '/admin/projects', label: '專案管理', hint: '案例研究、媒體、量化成果' },
  { href: '/admin/articles', label: '文章管理', hint: 'Markdown 文章與排程' },
  { href: '/admin/files', label: '檔案管理', hint: 'Storage 素材與個人照' },
  { href: '/admin/resume', label: '履歷管理', hint: '中英文 PDF' },
] as const;

/** The nav entry that owns `pathname`; `/admin` only matches itself so it never swallows sub-pages. */
export function currentAdminSection(pathname: string) {
  return adminNavLinks.find(link => link.href === '/admin'
    ? pathname === '/admin'
    : pathname === link.href || pathname.startsWith(`${link.href}/`));
}
