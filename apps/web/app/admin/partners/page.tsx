import { fmtDate, requireStaff, rightsActive, type Partner, type RightsRow } from '@/lib/admin';
import { PartnerForm } from '@/components/admin/PartnerForm';

export default async function Partners() {
  const { sb, isAdmin } = await requireStaff();
  const [{ data: p }, { data: r }] = await Promise.all([
    sb.from('partners').select('*').order('name'),
    sb.from('rights').select('*'),
  ]);
  const partners = (p ?? []) as Partner[];
  const rights = (r ?? []) as RightsRow[];

  return (
    <>
      <div className="a-head"><h1>Partners</h1></div>
      <div className="a-cols">
        <div className="a-col-main">
          {partners.length === 0 ? (
            <div className="empty"><h2>No partners yet</h2><p>Add the studios and rights holders you license films from.</p></div>
          ) : (
            <div className="a-table-wrap">
              <table className="a-table">
                <thead><tr><th>Partner</th><th>Contact</th><th>Agreements</th><th>Added</th></tr></thead>
                <tbody>
                  {partners.map((x) => {
                    const mine = rights.filter((y) => y.partner_id === x.id);
                    const active = mine.filter((y) => rightsActive(y)).length;
                    return (
                      <tr key={x.id}>
                        <td><b>{x.name}</b>{x.notes && <small>{x.notes}</small>}</td>
                        <td>
                          {x.contact_name ?? '—'}
                          {x.contact_email && <small><a href={`mailto:${x.contact_email}`}>{x.contact_email}</a></small>}
                        </td>
                        <td>{mine.length} total · <span className={active ? 'a-ok' : 'a-muted'}>{active} active</span></td>
                        <td className="a-muted">{fmtDate(x.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="a-col-side">
          {isAdmin ? <PartnerForm /> : <p className="a-muted">Only administrators can add partners.</p>}
        </div>
      </div>
    </>
  );
}
