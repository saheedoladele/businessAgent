"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSearchRun } from "@/agent/discover";
import { parseBusinessForm } from "@/lib/business-input";
import { db, logActivity } from "@/lib/db";
import { enqueue } from "@/lib/queue";

/** Server actions for the business pages (run on the server, called by plain <form>s). */

export async function createBusiness(form: FormData) {
  const r = parseBusinessForm(form);
  if ("error" in r) redirect(`/businesses/new?error=${encodeURIComponent(r.error)}`);
  const b = await db.business.create({ data: r.data });
  await logActivity(b.id, "business.created", `Set up ${b.name}`);
  redirect(`/businesses/${b.id}?notice=${encodeURIComponent("Business created. Run your first lead search.")}`);
}

export async function updateBusiness(id: string, form: FormData) {
  const r = parseBusinessForm(form);
  if ("error" in r) redirect(`/businesses/${id}?error=${encodeURIComponent(r.error)}`);
  await db.business.update({ where: { id }, data: r.data });
  revalidatePath(`/businesses/${id}`);
  redirect(`/businesses/${id}?notice=${encodeURIComponent("Changes saved")}`);
}

export async function toggleActive(id: string) {
  const b = await db.business.findUniqueOrThrow({ where: { id } });
  await db.business.update({ where: { id }, data: { active: !b.active } });
  await logActivity(id, "business.toggled", b.active ? "Agent paused" : "Agent resumed");
  redirect(`/businesses/${id}?notice=${encodeURIComponent(b.active ? "Agent paused" : "Agent resumed")}`);
}

export async function runDiscovery(id: string, form: FormData) {
  const query = String(form.get("query") ?? "").trim();
  const run = await createSearchRun(id, query || undefined);
  await enqueue("discover", { searchRunId: run.id }, `discover-${run.id}`);
  redirect(`/businesses/${id}?notice=${encodeURIComponent("Search started. New leads appear here in a minute or two.")}`);
}
