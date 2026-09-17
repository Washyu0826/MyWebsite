import 'server-only';
export function isDemoMode() {
  return process.env.DEMO_MODE === 'true' || (
    process.env.NODE_ENV !== 'production' && process.env.DEMO_MODE !== 'false'
    && !process.env.NEXT_PUBLIC_SUPABASE_URL
  );
}
export function publicCredentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Configure Supabase or explicitly set DEMO_MODE=true.');
  return { url, key };
}
