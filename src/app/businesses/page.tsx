import Link from "next/link";
import { db } from "@/lib/db";

export default async function BusinessesPage() {
  const businesses = await db.business.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { leads: true } } },
  });
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Businesses</h1>
          <p className="muted">Each business has its own ideal customer, sender and agent settings.</p>
        </div>
        <Link href="/businesses/new" className="btn btn-primary">
          + New business
        </Link>
      </div>
      {businesses.length === 0 ? (
        <div className="card empty">No businesses yet. Create one to start finding leads.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Sender</th>
                <th>Leads</th>
                <th>Agent</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link href={`/businesses/${b.id}`}>{b.name}</Link>
                  </td>
                  <td>{b.senderEmail}</td>
                  <td>{b._count.leads}</td>
                  <td>{b.active ? "Running" : "Paused"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
