'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { adminNavLinks, currentAdminSection } from './nav';

/**
 * Persistent admin navigation. A single list on every page (a horizontal strip on phones, a column
 * from 900px up) so the position of each item — and of the help block at the end — never moves,
 * which is what WCAG 2.2 Consistent Help (3.2.6) and Consistent Navigation (3.2.3) ask for.
 */
export function AdminSidebar() {
  const pathname = usePathname() || '';
  const current = currentAdminSection(pathname);

  return <nav className="admin-sidebar" aria-label="後台導覽">
    <p className="admin-sidebar-title">管理後台</p>
    <ul className="admin-sidebar-list">
      {adminNavLinks.map(link => {
        const active = current?.href === link.href;
        return <li key={link.href}>
          <Link className="admin-sidebar-link" href={link.href} aria-current={active ? 'page' : undefined}>
            <span className="admin-sidebar-label">{link.label}</span>
            <span className="admin-sidebar-hint">{link.hint}</span>
          </Link>
        </li>;
      })}
    </ul>
    <div className="admin-sidebar-help">
      <h2>需要協助</h2>
      <p>每頁的儲存按鈕都會即時回報結果。拖曳排序可改用「上移／下移」按鈕或鍵盤操作。</p>
      <Link className="admin-sidebar-help-link" href="/admin">回到後台首頁</Link>
    </div>
  </nav>;
}
