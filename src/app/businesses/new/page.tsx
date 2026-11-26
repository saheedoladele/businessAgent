import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createBusiness } from "../actions";
import { BusinessForm } from "../business-form";

export const metadata = { title: "Set up a business" };

export default function NewBusinessPage() {
  return (
    <div>
      <Link href="/businesses" className="back">
        <ArrowLeft size={14} aria-hidden /> Businesses
      </Link>
      <header className="page-head">
        <div>
          <h1>Set up a business</h1>
          <p className="lede">Tell the agent what you sell and who to look for. You can change any of this later.</p>
        </div>
      </header>
      <BusinessForm action={createBusiness} submitLabel="Create business" pendingLabel="Creating…" />
    </div>
  );
}
