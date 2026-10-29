'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff, slugify } from '@/lib/admin';

export type CatState = { error?: string; message?: string };
type Table = 'vjs' | 'genres';

function done() {
  revalidatePath('/', 'layout');
}

async function freeSlug(sb: Awaited<ReturnType<typeof requireStaff>>['sb'], table: Table, base: string) {
  const root = base || (table === 'vjs' ? 'vj' : 'genre');
  for (let i = 0; i < 50; i++) {
    const slug = i ? `${root}-${i + 1}` : root;
    const { data } = await sb.from(table).select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/** Add or rename a VJ / genre. The web address (slug) is set once so links keep working. */
export async function saveCategory(table: Table, id: number | null, _: CatState, form: FormData): Promise<CatState> {
  const { sb } = await requireStaff();
  const name = String(form.get('name') ?? '').trim().replace(/\s+/g, ' ');
  if (!name) return { error: 'Type a name.' };
  if (name.length > 60) return { error: 'Keep the name under 60 characters.' };
  const extra = table === 'vjs' ? { photo_url: String(form.get('photo_url') ?? '').trim() || null } : {};

  if (id) {
    const { error } = await sb.from(table).update({ name, ...extra }).eq('id', id);
    if (error) return { error: error.message };
    done();
    return { message: 'Saved.' };
  }
  const { data: last } = await sb.from(table).select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const { error } = await sb.from(table).insert({
    name,
    slug: await freeSlug(sb, table, slugify(name)),
    sort_order: (last?.sort_order ?? 0) + 1,
    ...extra,
  });
  if (error) return { error: error.message };
  done();
  return { message: `Added ${name}.` };
}

export async function setCategoryActive(table: Table, id: number, active: boolean) {
  const { sb } = await requireStaff();
  await sb.from(table).update({ active }).eq('id', id);
  done();
}

/** Move one place up (-1) or down (+1) in the list viewers see. */
export async function moveCategory(table: Table, id: number, dir: -1 | 1) {
  const { sb } = await requireStaff();
  const { data } = await sb.from(table).select('id').order('sort_order').order('name');
  const ids = (data ?? []).map((r) => r.id as number);
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await Promise.all(ids.map((x, n) => sb.from(table).update({ sort_order: n + 1 }).eq('id', x)));
  done();
}

/** Films keep existing; they just lose this VJ / genre. */
export async function deleteCategory(table: Table, id: number) {
  const { sb } = await requireStaff();
  await sb.from(table).delete().eq('id', id);
  done();
}
