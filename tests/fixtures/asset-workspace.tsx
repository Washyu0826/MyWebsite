import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AssetPicker } from '../../src/components/admin/asset-picker';
import { AssetWorkspace } from '../../src/components/admin/asset-workspace';

// Stands in for an editor field: the picker hands back a public URL and the page shows it.
function PickerDemo() {
  const [picked, setPicked] = useState('');
  return (
    <section aria-label="Picker demo" style={{ padding: '24px 28px' }}>
      <AssetPicker onSelect={item => setPicked(item.public_url)} />
      <output data-testid="picked">{picked}</output>
    </section>
  );
}

createRoot(document.getElementById('root')!).render(
  <div className="admin-shell">
    <header className="admin-topbar">
      <span>Admin</span>
      <span>Asset library test</span>
    </header>
    <aside className="admin-sidebar">
      <nav aria-label="Admin">
        <a href="#root">檔案管理</a>
      </nav>
    </aside>
    <main className="admin-main">
      <AssetWorkspace />
      <PickerDemo />
    </main>
  </div>,
);
