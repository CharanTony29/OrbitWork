-- 202611190003_chunked_attachment_uploads.sql
-- Enables resilient chunked uploads for files exceeding serverless payload thresholds (e.g. 4.5 MB - 25 MB).
-- Uploads stream into public.attachment_files in 3 MB slices, bypassing Vercel FUNCTION_PAYLOAD_TOO_LARGE.

create or replace function public.append_attachment_chunk(
  p_attachment_id uuid,
  p_chunk bytea,
  p_is_first boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_is_first then
    insert into public.attachment_files (id, file_bytes)
    values (p_attachment_id, p_chunk)
    on conflict (id) do update set file_bytes = p_chunk;
  else
    update public.attachment_files
    set file_bytes = file_bytes || p_chunk
    where id = p_attachment_id;
  end if;
end;
$$;
