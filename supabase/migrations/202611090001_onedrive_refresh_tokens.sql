-- 202611090001_onedrive_refresh_tokens.sql
-- Adds columns to store encrypted refresh tokens for Microsoft OneDrive & SharePoint

alter table public.workspace_storage_configs
  add column if not exists onedrive_refresh_token_ciphertext text;

alter table public.organization_storage_configs
  add column if not exists onedrive_refresh_token_ciphertext text;
