'use client';

import { useActionState, useState } from 'react';
import { deleteCategory, moveCategory, saveCategory, setCategoryActive, type CatState } from '@/app/admin/categories/actions';
import { ImageUpload } from './ImageUpload';

type Item = { id: number; name: string; slug: string; active: boolean; photo_url?: string | null };

/** One VJ or genre: rename, photo (VJs), show/hide, reorder, delete. */
export function CategoryItem({
  table, item, films, first, last,
}: { table: 'vjs' | 'genres'; item: Item; films: number; first: boolean; last: boolean }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<CatState, FormData>(saveCategory.bind(null, table, item.id), {});
  const isVj = table === 'vjs';

  return (
    <li className={`cat-item${item.active ? '' : ' hidden-item'}`}>
      <div className="cat-main">
        {isVj && (item.photo_url
          ? <img className="cat-avatar" src={item.photo_url} alt="" />
          : <span className="cat-avatar empty" aria-hidden="true">{item.name.replace(/^VJ\s+/i, '').slice(0, 2).toUpperCase()}</span>)}
        <div style={{ minWidth: 0, flex: 1 }}>
          <b>{item.name}</b>
          <small>
            {films} film{films === 1 ? '' : 's'}
            {!item.active && <> · <span className="a-badge muted">Hidden</span></>}
          </small>
        </div>
        <div className="cat-actions">
          <button type="button" className="icon-btn" disabled={first} aria-label={`Move ${item.name} up`} onClick={() => moveCategory(table, item.id, -1)}>↑</button>
          <button type="button" className="icon-btn" disabled={last} aria-label={`Move ${item.name} down`} onClick={() => moveCategory(table, item.id, 1)}>↓</button>
          <button type="button" className="btn btn-gray btn-small" onClick={() => setEditing((v) => !v)}>{editing ? 'Close' : 'Edit'}</button>
        </div>
      </div>

      {editing && (
        <div className="cat-edit">
          <form action={action} className="cat-form">
            {state.error && <div className="form-msg error" role="alert">{state.error}</div>}
            {state.message && <div className="form-msg ok" role="status">{state.message}</div>}
            <div className="a-field">
              <label htmlFor={`n-${table}-${item.id}`}>Name</label>
              <input id={`n-${table}-${item.id}`} name="name" className="input" defaultValue={item.name} required maxLength={60} />
            </div>
            {isVj && (
              <ImageUpload name="photo_url" label="Photo" hint="A square photo of the VJ works best." initial={item.photo_url ?? null} shape="round" />
            )}
            <button className="btn btn-accent btn-small" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
          </form>
          <div className="a-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-gray btn-small" onClick={() => setCategoryActive(table, item.id, !item.active)}>
              {item.active ? 'Hide from viewers' : 'Show to viewers'}
            </button>
            {confirming ? (
              <button type="button" className="btn btn-accent btn-small" onClick={() => deleteCategory(table, item.id)}>
                Tap again to delete
              </button>
            ) : (
              <button type="button" className="btn btn-gray btn-small" onClick={() => setConfirming(true)}>Delete</button>
            )}
          </div>
          {confirming && (
            <p className="a-muted" style={{ fontSize: 13 }}>
              The {films} film{films === 1 ? '' : 's'} stay on the site; they just lose this {isVj ? 'VJ' : 'genre'}.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function AddCategory({ table }: { table: 'vjs' | 'genres' }) {
  const [state, action, pending] = useActionState<CatState, FormData>(saveCategory.bind(null, table, null), {});
  const isVj = table === 'vjs';
  return (
    <form action={action} className="cat-add" key={state.message}>
      {state.error && <div className="form-msg error" role="alert">{state.error}</div>}
      {state.message && <div className="form-msg ok" role="status">{state.message}</div>}
      <div className="a-field">
        <label htmlFor={`add-${table}`}>{isVj ? 'New VJ name' : 'New genre name'}</label>
        <input id={`add-${table}`} name="name" className="input" required maxLength={60} placeholder={isVj ? 'e.g. VJ Junior' : 'e.g. Ugandan, Nollywood, Bollywood'} />
      </div>
      {isVj && <ImageUpload name="photo_url" label="Photo (optional)" hint="Viewers see this next to the VJ's name." initial={null} shape="round" />}
      <button className="btn btn-accent btn-small" disabled={pending}>{pending ? 'Adding…' : isVj ? 'Add VJ' : 'Add genre'}</button>
    </form>
  );
}
