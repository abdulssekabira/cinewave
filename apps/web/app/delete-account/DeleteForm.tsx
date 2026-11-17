'use client';

import { useActionState } from 'react';
import { deleteAccount, type DeleteState } from './actions';

export function DeleteForm() {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccount, {});
  return (
    <form action={action} style={{ display: 'grid', gap: 10, marginTop: 14 }}>
      {state.error && <div className="form-msg error" role="alert">{state.error}</div>}
      <label htmlFor="confirm">Type <b>DELETE</b> to confirm</label>
      <input id="confirm" name="confirm" className="input" autoComplete="off" placeholder="DELETE" />
      <button className="btn btn-accent" disabled={pending}>{pending ? 'Deleting…' : 'Delete my account forever'}</button>
    </form>
  );
}
