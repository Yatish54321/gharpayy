import { supabase } from "@/integrations/supabase/client";

export interface WorkflowEvent {
  id: string;
  module: string;
  customer_id: string | null;
  lead_id: string | null;
  action: string;
  payload: Record<string, unknown>;
  actor_id: string | null;
  actor: string | null;
  occurred_at: string;
}

export interface AppendWorkflowEvent {
  module: string;
  customerId?: string;
  leadId?: string;
  action: string;
  payload?: Record<string, unknown>;
  actor?: string;
  occurredAt?: string;
}

type WorkflowEventQuery = {
  order: (column: string, options: { ascending: boolean }) => {
    limit: (count: number) => Promise<{ data: WorkflowEvent[] | null; error: { message: string } | null }>;
  };
};

type WorkflowEventsClient = {
  from: (table: "workflow_events") => {
    insert: (row: Record<string, unknown>) => {
      select: () => {
        single: () => Promise<{ data: WorkflowEvent | null; error: { message: string } | null }>;
      };
    };
    select: (columns: string) => {
      eq: (column: string, value: string) => WorkflowEventQuery & {
        eq: (column: string, value: string) => WorkflowEventQuery;
      };
    };
  };
};

const eventsClient = supabase as unknown as WorkflowEventsClient;

export async function appendWorkflowEvent(input: AppendWorkflowEvent): Promise<WorkflowEvent> {
  const { data, error } = await eventsClient.from("workflow_events").insert({
    module: input.module,
    customer_id: input.customerId ?? null,
    lead_id: input.leadId ?? null,
    action: input.action,
    payload: input.payload ?? {},
    actor: input.actor ?? null,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
  }).select().single();
  if (error) throw new Error(`Could not append workflow event: ${error.message}`);
  if (!data) throw new Error("Could not append workflow event: no row returned");
  return data;
}

export async function fetchWorkflowEvents(
  module: string,
  customerId?: string,
  limit = 100,
): Promise<WorkflowEvent[]> {
  const query = eventsClient.from("workflow_events").select("*").eq("module", module);
  const scoped = customerId ? query.eq("customer_id", customerId) : query;
  const { data, error } = await scoped.order("occurred_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Could not fetch workflow events: ${error.message}`);
  return data ?? [];
}

/** Opens a real external action and records intent; provider delivery is never simulated. */
export function openExternalAction(
  kind: "whatsapp" | "call",
  target: string,
  event: Omit<AppendWorkflowEvent, "action">,
): void {
  const href = kind === "whatsapp"
    ? `https://wa.me/${target.replace(/\D/g, "")}`
    : `tel:${target.replace(/\s/g, "")}`;
  void appendWorkflowEvent({ ...event, action: `${kind}_intent`, payload: { target } })
    .catch((error: unknown) => console.error("[workflow-events]", error));
  window.open(href, kind === "whatsapp" ? "_blank" : "_self", "noopener,noreferrer");
}
