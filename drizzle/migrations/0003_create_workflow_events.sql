CREATE TABLE public.workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  customer_id text,
  lead_id text,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid DEFAULT auth.uid(),
  actor text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX workflow_events_module_customer_idx
  ON public.workflow_events (module, customer_id, occurred_at DESC);
CREATE INDEX workflow_events_lead_idx
  ON public.workflow_events (lead_id, occurred_at DESC);

GRANT SELECT, INSERT ON public.workflow_events TO authenticated;
GRANT ALL ON public.workflow_events TO service_role;

ALTER TABLE public.workflow_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated operators append workflow events"
  ON public.workflow_events FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

CREATE POLICY "Authenticated operators read workflow events"
  ON public.workflow_events FOR SELECT TO authenticated
  USING (actor_id = auth.uid() OR actor_id IS NULL OR public.is_tower_ops(auth.uid()));
