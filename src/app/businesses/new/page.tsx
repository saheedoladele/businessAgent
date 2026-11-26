import { Flash } from "@/components/ui";
import { createBusiness } from "../actions";
import { BusinessForm } from "../business-form";

export default async function NewBusinessPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Set up a business</h1>
          <p className="muted">Tell the agent what you sell and who to find. You can change any of this later.</p>
        </div>
      </div>
      <Flash error={error} />
      <BusinessForm action={createBusiness} submitLabel="Create business" />
    </div>
  );
}
