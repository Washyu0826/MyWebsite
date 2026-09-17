'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { signInAction, type SignInState } from './actions';

const initialState: SignInState = { ok: false, message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="admin-button" type="submit" disabled={pending}>
    {pending ? '登入中...' : '登入'}
  </button>;
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signInAction, initialState);
  return <form className="admin-form" action={formAction}>
    <input type="hidden" name="next" value={next} />
    <label>
      <span>Email</span>
      <input name="email" type="email" autoComplete="username" required />
    </label>
    <label>
      <span>密碼</span>
      <input name="password" type="password" autoComplete="current-password" required />
    </label>
    <SubmitButton />
    {state.message && <p className="admin-error" role="alert">{state.message}</p>}
  </form>;
}
