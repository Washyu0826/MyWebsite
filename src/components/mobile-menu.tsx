'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Menu, X } from 'lucide-react';
import { Navigation } from './navigation';
import { Button } from './ui/button';
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const t = useTranslations('Site');
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild><Button variant="ghost" aria-label={t('openMenu')} className="md:hidden"><Menu size={20} /></Button></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-paper" />
      <Dialog.Content className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-paper px-5 py-6" aria-describedby={undefined}>
        <div className="flex items-center justify-between border-b border-rule pb-5">
          <Dialog.Title className="text-h3">{t('navigation')}</Dialog.Title>
          <Dialog.Close asChild><Button variant="ghost" aria-label={t('closeMenu')}><X size={20} /></Button></Dialog.Close>
        </div>
        <nav className="mt-8 flex flex-col items-start gap-4 [&_a]:text-h2" aria-label={t('navigation')}>
          <Navigation onNavigate={() => setOpen(false)} />
        </nav>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
