import type { Business } from "@prisma/client";
import { SubmitButton } from "@/components/submit-button";

/** Shared create/edit form. `action` is a server action. */
export function BusinessForm({
  business: b,
  action,
  submitLabel,
  pendingLabel,
}: {
  business?: Business | null;
  action: (form: FormData) => Promise<void>;
  submitLabel: string;
  pendingLabel: string;
}) {
  return (
    <form action={action} className="panel form">
      <div className="fieldset">
        <div className="fieldset-intro">
          <h2>Your business</h2>
          <p>Claude reads this before writing every email, so be specific.</p>
        </div>
        <div className="fields">
          <div className="fields fields-2">
            <label className="field">
              <span className="label">Business name</span>
              <input type="text" name="name" defaultValue={b?.name} required />
            </label>
            <label className="field">
              <span className="label">Website</span>
              <input type="text" name="website" defaultValue={b?.website ?? ""} placeholder="yourbusiness.com" />
            </label>
          </div>
          <label className="field">
            <span className="label">What you do</span>
            <textarea name="description" defaultValue={b?.description} required placeholder="We build custom web apps and dashboards for growing businesses." />
          </label>
          <label className="field">
            <span className="label">Services <span className="hint">One per line</span></span>
            <textarea name="services" defaultValue={b?.services} required />
          </label>
        </div>
      </div>

      <div className="fieldset">
        <div className="fieldset-intro">
          <h2>Who to find</h2>
          <p>The agent searches the web for companies that match this description.</p>
        </div>
        <div className="fields">
          <label className="field">
            <span className="label">Ideal customer <span className="hint">Industry, size, and the problem you solve for them</span></span>
            <textarea
              name="idealCustomer"
              defaultValue={b?.idealCustomer}
              required
              placeholder="Logistics and retail companies with 10-200 staff that still run on spreadsheets or have an outdated website."
            />
          </label>
          <label className="field">
            <span className="label">Locations <span className="hint">Optional. Separate with semicolons.</span></span>
            <input type="text" name="targetLocations" defaultValue={b?.targetLocations ?? ""} placeholder="Lagos, Nigeria; Abuja, Nigeria" />
          </label>
        </div>
      </div>

      <div className="fieldset">
        <div className="fieldset-intro">
          <h2>Sending &amp; booking</h2>
          <p>Emails go out from this name and address. Interested leads get your booking link.</p>
        </div>
        <div className="fields fields-2">
          <label className="field">
            <span className="label">Sender name</span>
            <input type="text" name="senderName" defaultValue={b?.senderName} required />
          </label>
          <label className="field">
            <span className="label">Sender email <span className="hint">Must match your SMTP login</span></span>
            <input type="email" name="senderEmail" defaultValue={b?.senderEmail} required />
          </label>
          <label className="field">
            <span className="label">Booking link</span>
            <input type="text" name="bookingUrl" defaultValue={b?.bookingUrl ?? ""} placeholder="https://cal.com/you/intro-call" />
          </label>
          <label className="field">
            <span className="label">Postal address <span className="hint">Shown in the email footer</span></span>
            <input type="text" name="physicalAddress" defaultValue={b?.physicalAddress ?? ""} />
          </label>
        </div>
      </div>

      <div className="fieldset">
        <div className="fieldset-intro">
          <h2>How the agent works</h2>
          <p>Start cautious on a new email domain, then raise the limit as replies come in.</p>
        </div>
        <div className="fields">
          <div className="fields fields-2">
            <label className="field">
              <span className="label">Emails per day <span className="hint">10-20 for a new domain</span></span>
              <input type="number" name="dailySendLimit" min={1} max={500} defaultValue={b?.dailySendLimit ?? 20} />
            </label>
            <label className="field">
              <span className="label">Minimum fit score <span className="hint">0-100. Leads below it are skipped.</span></span>
              <input type="number" name="minFitScore" min={0} max={100} defaultValue={b?.minFitScore ?? 60} />
            </label>
          </div>
          <label className="field">
            <span className="label">Follow-up gaps in days <span className="hint">One number per follow-up, e.g. 3, 7, 14</span></span>
            <input type="text" name="followUpDays" defaultValue={(b?.followUpDays ?? [3, 7, 14]).join(", ")} />
          </label>
          <label className="toggle">
            <input type="checkbox" name="requireApproval" defaultChecked={b?.requireApproval ?? true} />
            <div>
              <strong>Let me approve first emails and booking replies</strong>
              <span>Follow-ups go out automatically once you&apos;ve approved the first email.</span>
            </div>
          </label>
          <label className="toggle">
            <input type="checkbox" name="autoDiscover" defaultChecked={b?.autoDiscover ?? false} />
            <div>
              <strong>Find new leads automatically</strong>
              <span>Runs one web search a day when fewer leads are waiting than your daily email limit.</span>
            </div>
          </label>
        </div>
      </div>

      <div className="form-actions">
        <SubmitButton pendingText={pendingLabel}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
