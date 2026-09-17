import 'server-only';
let warnedDemoIgnored = false;
// Production deployments (Vercel) never serve sample content, even if DEMO_MODE=true leaks into the environment.
// Local `next build` / `next start` also run with NODE_ENV=production, so only the deployment target counts here.
function isProductionDeployment() {
  return process.env.VERCEL_ENV === 'production';
}
export function isDemoMode() {
  if (process.env.DEMO_MODE === 'true') {
    if (!isProductionDeployment()) return true;
    if (!warnedDemoIgnored) {
      warnedDemoIgnored = true;
      console.warn('DEMO_MODE=true ignored in production');
    }
    return false;
  }
  return process.env.NODE_ENV !== 'production' && process.env.DEMO_MODE !== 'false'
    && !process.env.NEXT_PUBLIC_SUPABASE_URL;
}
export function publicCredentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Configure Supabase or explicitly set DEMO_MODE=true.');
  return { url, key };
}
