-- Generic increment RPC for counters (views, likes, etc.)
-- Used by communityService.ts for post view counts
CREATE OR REPLACE FUNCTION public.increment(
  row_id uuid,
  table_name text,
  column_name text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I SET %I = COALESCE(%I, 0) + 1 WHERE id = $1',
    table_name, column_name, column_name
  ) USING row_id;
END;
$$;
