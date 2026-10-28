'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff, slugify } from '@/lib/admin';

function done() {
  revalidatePath('/', 'layout');
}

export async function createRow(form: FormData) {
  const { sb } = await requireStaff();
  const name = String(form.get('name') ?? '').trim();
  if (!name) return;
  const { data: last } = await sb.from('collections').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
  await sb.from('collections').insert({
    name,
    slug: `${slugify(name) || 'row'}-${Date.now().toString(36)}`,
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  done();
}

export async function setRowActive(id: number, active: boolean) {
  const { sb } = await requireStaff();
  await sb.from('collections').update({ active }).eq('id', id);
  done();
}

export async function deleteRow(id: number) {
  const { sb } = await requireStaff();
  await sb.from('collections').delete().eq('id', id);
  done();
}

export async function addToRow(id: number, form: FormData) {
  const { sb } = await requireStaff();
  const titleId = String(form.get('title_id') ?? '');
  if (!titleId) return;
  const { data: last } = await sb
    .from('collection_items').select('position').eq('collection_id', id)
    .order('position', { ascending: false }).limit(1).maybeSingle();
  await sb.from('collection_items').upsert({ collection_id: id, title_id: titleId, position: (last?.position ?? 0) + 1 });
  done();
}

export async function removeFromRow(id: number, titleId: string) {
  const { sb } = await requireStaff();
  await sb.from('collection_items').delete().eq('collection_id', id).eq('title_id', titleId);
  done();
}

/** Swap a film with its neighbour in the row. */
export async function moveInRow(id: number, titleId: string, dir: -1 | 1) {
  const { sb } = await requireStaff();
  const { data } = await sb.from('collection_items').select('title_id, position').eq('collection_id', id).order('position');
  const items = data ?? [];
  const i = items.findIndex((x) => x.title_id === titleId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= items.length) return;
  const order = items.map((x) => x.title_id);
  [order[i], order[j]] = [order[j], order[i]];
  await Promise.all(
    order.map((tid, n) => sb.from('collection_items').update({ position: n + 1 }).eq('collection_id', id).eq('title_id', tid)),
  );
  done();
}

/** Move a whole row up or down the home page. */
export async function moveRow(id: number, dir: -1 | 1) {
  const { sb } = await requireStaff();
  const { data } = await sb.from('collections').select('id, sort_order').order('sort_order');
  const rows = data ?? [];
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  const order = rows.map((r) => r.id);
  [order[i], order[j]] = [order[j], order[i]];
  await Promise.all(order.map((rid, n) => sb.from('collections').update({ sort_order: n + 1 }).eq('id', rid)));
  done();
}
