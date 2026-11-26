import type { Business } from "@prisma/client";

/** Shared create/edit form. `action` is a server action. */
export function BusinessForm({ business, action, submitLabel }: {
  business?: Business | null;
  action: (form: FormData) => Promise<void>;
  submitLabel: string;
}) {
  const b = business;
  return (
    <form action={action} className="form card">
      <h2>About the business</h2>
      <div className="grid grid-2">
        <label>
          Business name
          <input type="text" name="name" defaultValue={b?.name} required />
        </label>
        <label>
          Website
          <input type="text" name="website" defaultValue={b?.website ?? ""} placeholder="yourbusiness.com" />
        </label>
      </div>
      <label>
        Description <span className="hint">What you do, in plain words. Claude uses this in every email.</span>
        <textarea name="description" defaultValue={b?.description} required />
      </label>
      <label>
        Services <span className="hint">One per line</span>
        <textarea name="services" defaultValue={b?.services} required />
      </label>

      <h2>Who you want to reach</h2>
      <label>
        Ideal customer <span className="hint">Industry, company size, and the problems you solve for them</span>
        <textarea name="idealCustomer" defaultValue={b?.idealCustomer} required />
      </label>
      <label>
        Target locations <span className="hint">Optional, e.g. &quot;Lagos, Nigeria; Abuja, Nigeria&quot;</span>
        <input type="text" name="targetLocations" defaultValue={b?.targetLocations ?? ""} />
      </label>

      <h2>Sender &amp; booking</h2>
      <div className="grid grid-2">
        <label>
          Sender name
          <input type="text" name="senderName" defaultValue={b?.senderName} required />
        </label>
        <label>
          Sender email <span className="hint">Must match your SMTP account</span>
          <input type="email" name="senderEmail" defaultValue={b?.senderEmail} required />
        </label>
        <label>
          Booking link <span className="hint">Your Cal.com event link</span>
          <input type="text" name="bookingUrl" defaultValue={b?.bookingUrl ?? ""} placeholder="https://cal.com/you/intro" />
        </label>
        <label>
          Postal address <span className="hint">Shown in the email footer (required by anti-spam laws)</span>
          <input type="text" name="physicalAddress" defaultValue={b?.physicalAddress ?? ""} />
        </label>
      </div>

      <h2>Agent behaviour</h2>
      <div className="grid grid-2">
        <label>
          Daily email limit <span className="hint">Start with 10-20 on a new domain</span>
          <input type="number" name="dailySendLimit" min={1} max={500} defaultValue={b?.dailySendLimit ?? 30} />
        </label>
        <label>
          Minimum fit score <span className="hint">0-100; leads below this are dropped</span>
          <input type="number" name="minFitScore" min={0} max={100} defaultValue={b?.minFitScore ?? 60} />
        </label>
        <label>
          Follow-up days <span className="hint">Days to wait before each follow-up, e.g. 3, 7, 14</span>
          <input type="text" name="followUpDays" defaultValue={(b?.followUpDays ?? [3, 7, 14]).join(", ")} />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" name="requireApproval" defaultChecked={b?.requireApproval ?? true} />
        Review first emails and booking replies before they're sent (recommended)
      </label>
      <label className="check">
        <input type="checkbox" name="autoDiscover" defaultChecked={b?.autoDiscover ?? false} />
        Search for new leads automatically once a day when the pipeline runs low
      </label>
      <div>
        <button className="btn btn-primary" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
