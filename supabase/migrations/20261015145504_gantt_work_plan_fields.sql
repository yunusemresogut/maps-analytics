-- Primavera P6 imports and editable Gantt metadata for store work plans.
ALTER TABLE public.store_work_plan
	ADD COLUMN IF NOT EXISTS source_task_id text,
	ADD COLUMN IF NOT EXISTS activity_code text,
	ADD COLUMN IF NOT EXISTS wbs_code text,
	ADD COLUMN IF NOT EXISTS percent_complete numeric(5, 2) NOT NULL DEFAULT 0,
	ADD COLUMN IF NOT EXISTS predecessors jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'store_work_plan_percent_complete_range'
			AND conrelid = 'public.store_work_plan'::regclass
	) THEN
		ALTER TABLE public.store_work_plan
			ADD CONSTRAINT store_work_plan_percent_complete_range
			CHECK (percent_complete >= 0 AND percent_complete <= 100);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'store_work_plan_predecessors_array'
			AND conrelid = 'public.store_work_plan'::regclass
	) THEN
		ALTER TABLE public.store_work_plan
			ADD CONSTRAINT store_work_plan_predecessors_array
			CHECK (jsonb_typeof(predecessors) = 'array');
	END IF;
END;
$$;

UPDATE public.store_work_plan
SET percent_complete = CASE
	WHEN status = 'tamamlandi' THEN 100
	WHEN status = 'devam_ediyor' THEN 50
	ELSE 0
END
WHERE percent_complete = 0;

CREATE INDEX IF NOT EXISTS store_work_plan_source_task_id_idx
	ON public.store_work_plan (store_id, source_task_id)
	WHERE source_task_id IS NOT NULL;
