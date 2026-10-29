import Link from 'next/link';
import { getGenres, getVjs } from '@cinewave/shared';
import { requireStaff } from '@/lib/admin';
import { TitleForm } from '@/components/admin/TitleForm';

export default async function NewTitle() {
  const { sb } = await requireStaff();
  const [genres, vjs] = await Promise.all([getGenres(sb, true), getVjs(sb, true)]);
  return (
    <>
      <div className="a-head">
        <div>
          <Link href="/admin/titles" className="a-back">← Films</Link>
          <h1>Add film</h1>
        </div>
      </div>
      <p className="a-muted" style={{ marginTop: -8, marginBottom: 20 }}>
        Save it as a draft first. After saving you can add the rights window that makes it visible.
      </p>
      <TitleForm title={null} genres={genres} selectedGenres={[]} vjs={vjs} />
    </>
  );
}
