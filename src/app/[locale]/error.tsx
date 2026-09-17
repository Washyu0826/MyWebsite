'use client';
import { useTranslations } from 'next-intl';
import { Container } from '@/components/container';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations('Site');
  return <Container className="page"><h1 className="text-h1">{t('errorTitle')}</h1>
    <p className="my-6 text-graphite">{t('errorBody')}</p><Button onClick={reset}>{t('retry')}</Button></Container>;
}
