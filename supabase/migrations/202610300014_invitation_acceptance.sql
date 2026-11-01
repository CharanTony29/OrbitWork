create or replace function public.accept_organization_invitation(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  invite public.invitations%rowtype;
begin
  if current_user_id is null or current_email = '' then raise exception 'Sign in to accept this invitation'; end if;
  select * into invite from public.invitations i
    where i.token_hash = encode(extensions.digest(invite_token, 'sha256'), 'hex')
      and i.status = 'pending' and i.expires_at > now()
    for update;
  if not found then raise exception 'Invitation is invalid or expired'; end if;
  if lower(invite.email) <> current_email then raise exception 'This invitation belongs to another email address'; end if;
  insert into public.organization_members (organization_id, user_id, role, status)
    values (invite.organization_id, current_user_id, invite.role, 'active')
    on conflict (organization_id, user_id) do update set role = excluded.role, status = 'active';
  if invite.workspace_id is not null then
    insert into public.workspace_members (workspace_id, user_id, role, status)
      values (invite.workspace_id, current_user_id, invite.role, 'active')
      on conflict (workspace_id, user_id) do update set role = excluded.role, status = 'active';
  end if;
  update public.invitations set status = 'accepted' where id = invite.id;
  insert into public.audit_events (organization_id, actor_id, entity_type, entity_id, action)
    values (invite.organization_id, current_user_id, 'invitation', invite.id::text, 'accepted');
  return invite.organization_id;
end;
$$;

revoke all on function public.accept_organization_invitation(text) from public;
grant execute on function public.accept_organization_invitation(text) to authenticated;
