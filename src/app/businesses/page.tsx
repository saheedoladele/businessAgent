import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";

export const metadata = { title: "Businesses" };

export default async function BusinessesPage() {
  const businesses = await db.business.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { leads: true } } },
  });
  return (
    <div>
      <header className="page-head">
        <div>
          <h1>Businesses</h1>
          <p className="lede">Each business has its own ideal customer, sender and agent settings.</p>
        </div>
        <Link href="/businesses/new" className="btn btn-primary">
          <Plus size={16} aria-hidden /> New business
        </Link>
      </header>
      {businesses.length === 0 ? (
        <div className="panel">
          <p className="empty-note">No businesses yet. Set one up to start finding leads.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Business</th>
                <th>Sends as</th>
                <th>Leads</th>
                <th>Agent</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link href={`/businesses/${b.id}`} style={{ fontWeight: 600 }}>
                      {b.name}
                    </Link>
                    {b.website && <div className="sub">{b.website.replace(/^https?:\/\//, "")}</div>}
                  </td>
                  <td>
                    {b.senderName}
                    <div className="sub">{b.senderEmail}</div>
                  </td>
                  <td>{b._count.leads}</td>
                  <td>
                    <span className={`badge ${b.active ? "badge-green" : "badge-gray"}`}>{b.active ? "Running" : "Paused"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
