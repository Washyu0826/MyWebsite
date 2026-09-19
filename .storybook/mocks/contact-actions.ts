// The real action writes to Supabase and calls Resend. A story only needs the shape of the reply,
// so this echoes back whatever the outcome picker on the story asked for.
export type ContactState =
  | { status: 'idle' }
  | { status: 'ok'; emailed: boolean }
  | { status: 'error'; code: 'invalid' | 'rate' | 'generic'; fields?: ('name' | 'email' | 'message')[] };

export const contactOutcome: { value: ContactState } = { value: { status: 'ok', emailed: true } };

export async function sendMessageAction(_previous: ContactState, _formData: FormData): Promise<ContactState> {
  await new Promise(done => setTimeout(done, 600));
  return contactOutcome.value;
}
