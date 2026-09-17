'use client';
import * as Dialog from '@radix-ui/react-dialog';
import Image from 'next/image';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from './ui/button';
export function ImageLightbox({ src, alt, width = 1200, height = 675, priority = false }: {
  src: string; alt: string; width?: number; height?: number; priority?: boolean;
}) {
  const t = useTranslations('Projects');
  return <Dialog.Root>
    <Dialog.Trigger asChild><button className="block w-full overflow-hidden rounded-lg border border-rule" aria-label={t('enlarge', { alt })}>
      <Image src={src} alt={alt} width={width} height={height} priority={priority}
        sizes="(max-width: 767px) calc(100vw - 40px), 900px" className="h-auto w-full bg-ash" />
    </button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-paper/95" />
      <Dialog.Content className="fixed inset-4 z-50 flex flex-col gap-4 overflow-auto bg-paper p-2 md:inset-10" aria-describedby={undefined}>
        <div className="flex items-center justify-between gap-4"><Dialog.Title className="text-meta">{alt}</Dialog.Title>
          <Dialog.Close asChild><Button variant="outline" aria-label={t('closeImage')}><X size={20} /></Button></Dialog.Close></div>
        <div className="relative min-h-0 flex-1"><Image src={src} alt={alt} fill sizes="95vw" className="object-contain" /></div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
