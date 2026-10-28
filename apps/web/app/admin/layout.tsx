import type { Metadata } from 'next';
import { requireStaff } from '@/lib/admin';
import { AdminNav } from '@/components/admin/AdminNav';

export const metadata: Metadata = { title: 'Admin', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = await requireStaff();
  return (
    <div className="admin">
      <aside className="admin-side">
        <div className="admin-brand">
          Admin
          <span>{isAdmin ? 'Administrator' : 'Editor'} · {user.email}</span>
        </div>
        <AdminNav isAdmin={isAdmin} />
      </aside>
      <div className="admin-main">{children}</div>
    </div>
  );
}
