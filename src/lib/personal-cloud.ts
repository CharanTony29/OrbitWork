import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  decryptRefreshToken,
  getDriveFile,
  GoogleDriveError,
  uploadPersonalDriveFile,
} from "./google-drive";
import {
  decryptOneDriveToken,
  encryptOneDriveToken,
  getOneDriveFile,
  OneDriveError,
  uploadProjectOneDriveFile,
} from "./onedrive";
import { isSchemaMissingError } from "./chat";

export type PersonalCloudProvider = "google_drive" | "onedrive";
export type OrgChatStoragePolicyMode = "any" | "org_domain_only";
export type OrgChatAllowedProviders = "both" | "onedrive" | "google_drive";

export interface OrgChatStoragePolicy {
  organizationId: string;
  organizationName: string;
  policy: OrgChatStoragePolicyMode;
  allowedProviders: OrgChatAllowedProviders;
  allowedDomains: string[];
}

export interface UserCloudConnectionRow {
  id: string;
  user_id: string;
  provider: PersonalCloudProvider;
  account_email: string | null;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  folder_name: string;
  is_active: boolean;
  connected_at: string;
  updated_at: string;
}

export interface UserCloudConnectionSummary {
  id: string;
  provider: PersonalCloudProvider;
  accountEmail: string | null;
  folderName: string;
  isActive: boolean;
  connectedAt: string;
  updatedAt: string;
}

export function normalizeDomainList(raw: string[] | string | null | undefined): string[] {
  const parts = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[\s,;]+/)
      : [];

  const cleaned = new Set<string>();
  for (const item of parts) {
    const domain = String(item)
      .trim()
      .toLowerCase()
      .replace(/^\*@?/, "")
      .replace(/^@/, "")
      .replace(/\/.*$/, "");
    if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain)) {
      cleaned.add(domain);
    }
  }
  return [...cleaned];
}

export function extractEmailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  const atIdx = trimmed.lastIndexOf("@");
  if (atIdx < 1 || atIdx === trimmed.length - 1) return null;
  return trimmed.slice(atIdx + 1);
}

export function validateAccountAgainstPolicy(
  provider: PersonalCloudProvider,
  accountEmail: string | null | undefined,
  policy: OrgChatStoragePolicy
): { ok: true } | { ok: false; reason: string } {
  const orgLabel = policy.organizationName || "Your organization";

  if (policy.allowedProviders === "onedrive" && provider !== "onedrive") {
    return {
      ok: false,
      reason: `${orgLabel} requires Microsoft OneDrive for chat & group attachments.`,
    };
  }
  if (policy.allowedProviders === "google_drive" && provider !== "google_drive") {
    return {
      ok: false,
      reason: `${orgLabel} requires Google Drive for chat & group attachments.`,
    };
  }

  if (policy.policy === "org_domain_only") {
    const allowedDomains = normalizeDomainList(policy.allowedDomains);
    if (allowedDomains.length > 0) {
      const domain = extractEmailDomain(accountEmail);
      if (!domain || !allowedDomains.includes(domain)) {
        const expectedText = allowedDomains.map((d) => `*@${d}`).join(", ");
        return {
          ok: false,
          reason: `${orgLabel} only permits organization cloud accounts (${expectedText}). ${
            accountEmail ? `"${accountEmail}" does not match.` : "No matching account email was found."
          }`,
        };
      }
    }
  }

  return { ok: true };
}

export function validateAccountAgainstPolicies(
  provider: PersonalCloudProvider,
  accountEmail: string | null | undefined,
  policies: OrgChatStoragePolicy[]
): { ok: true } | { ok: false; reason: string; organizationId: string } {
  for (const policy of policies) {
    const check = validateAccountAgainstPolicy(provider, accountEmail, policy);
    if (!check.ok) {
      return { ok: false, reason: check.reason, organizationId: policy.organizationId };
    }
  }
  return { ok: true };
}

export async function getOrgChatCloudPolicy(
  supabase: SupabaseClient,
  organizationId: string
): Promise<OrgChatStoragePolicy> {
  const fallback: OrgChatStoragePolicy = {
    organizationId,
    organizationName: "Organization",
    policy: "any",
    allowedProviders: "both",
    allowedDomains: [],
  };

  const ext = await supabase
    .from("organizations")
    .select("id, name, chat_storage_policy, chat_storage_allowed_providers, chat_storage_allowed_domains")
    .eq("id", organizationId)
    .maybeSingle();

  if (ext.error) {
    if (isSchemaMissingError(ext.error)) {
      const base = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", organizationId)
        .maybeSingle();
      return {
        ...fallback,
        organizationName: base.data?.name || "Organization",
      };
    }
    return fallback;
  }

  if (!ext.data) return fallback;

  return {
    organizationId: ext.data.id,
    organizationName: ext.data.name || "Organization",
    policy: ext.data.chat_storage_policy === "org_domain_only" ? "org_domain_only" : "any",
    allowedProviders:
      ext.data.chat_storage_allowed_providers === "onedrive" ||
      ext.data.chat_storage_allowed_providers === "google_drive"
        ? ext.data.chat_storage_allowed_providers
        : "both",
    allowedDomains: normalizeDomainList(ext.data.chat_storage_allowed_domains as string[] | null),
  };
}

export async function getUserApplicableOrgPolicies(
  supabase: SupabaseClient,
  userId: string
): Promise<OrgChatStoragePolicy[]> {
  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("status", "active");

  const orgIds = [...new Set((memberships ?? []).map((m) => m.organization_id).filter(Boolean))];
  if (orgIds.length === 0) return [];

  const ext = await supabase
    .from("organizations")
    .select("id, name, chat_storage_policy, chat_storage_allowed_providers, chat_storage_allowed_domains")
    .in("id", orgIds);

  if (ext.error) {
    return [];
  }

  return (ext.data ?? []).map((org) => ({
    organizationId: org.id,
    organizationName: org.name || "Organization",
    policy: org.chat_storage_policy === "org_domain_only" ? "org_domain_only" : "any",
    allowedProviders:
      org.chat_storage_allowed_providers === "onedrive" ||
      org.chat_storage_allowed_providers === "google_drive"
        ? org.chat_storage_allowed_providers
        : "both",
    allowedDomains: normalizeDomainList(org.chat_storage_allowed_domains as string[] | null),
  }));
}

export async function getUserPersonalCloudConnections(
  supabase: SupabaseClient,
  userId: string
): Promise<{ connections: UserCloudConnectionRow[]; migrationMissing: boolean }> {
  const { data, error } = await supabase
    .from("user_cloud_connections")
    .select("id, user_id, provider, account_email, access_token_encrypted, refresh_token_encrypted, folder_name, is_active, connected_at, updated_at")
    .eq("user_id", userId)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    if (isSchemaMissingError(error)) {
      return { connections: [], migrationMissing: true };
    }
    return { connections: [], migrationMissing: false };
  }

  return {
    connections: (data ?? []) as UserCloudConnectionRow[],
    migrationMissing: false,
  };
}

export function toPublicCloudConnection(row: UserCloudConnectionRow): UserCloudConnectionSummary {
  return {
    id: row.id,
    provider: row.provider,
    accountEmail: row.account_email,
    folderName: row.folder_name || "Orbitwork Chat",
    isActive: Boolean(row.is_active),
    connectedAt: row.connected_at,
    updatedAt: row.updated_at,
  };
}

async function getPersonalGoogleAccessToken(refreshTokenCiphertext: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new GoogleDriveError("configuration");
  const refreshToken = decryptRefreshToken(refreshTokenCiphertext);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new GoogleDriveError("reconnect", response.status);
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new GoogleDriveError("reconnect");
  return payload.access_token;
}

async function getPersonalOneDriveAccessToken(
  connection: UserCloudConnectionRow,
  dbClient: SupabaseClient
): Promise<string> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new OneDriveError("configuration");
  const encryptedRefresh = connection.refresh_token_encrypted || connection.access_token_encrypted;
  const refreshToken = decryptOneDriveToken(encryptedRefresh);
  const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new OneDriveError("reconnect", response.status);
  const payload = (await response.json()) as { access_token?: string; refresh_token?: string };
  if (!payload.access_token) throw new OneDriveError("reconnect");

  if (payload.refresh_token && payload.refresh_token !== refreshToken) {
    try {
      const rotated = encryptOneDriveToken(payload.refresh_token);
      await dbClient
        .from("user_cloud_connections")
        .update({ refresh_token_encrypted: rotated, updated_at: new Date().toISOString() })
        .eq("id", connection.id);
    } catch {
      // non-fatal
    }
  }
  return payload.access_token;
}

export async function uploadChatFileToPersonalCloud(
  dbClient: SupabaseClient,
  connection: UserCloudConnectionRow,
  fileName: string,
  mimeType: string,
  bytes: Uint8Array
): Promise<{ provider: PersonalCloudProvider; externalFileId: string }> {
  const folder = connection.folder_name?.trim() || "Orbitwork Chat";
  const uniquePrefix = randomUUID().slice(0, 8);
  const storedName = `${uniquePrefix}_${fileName}`;

  if (connection.provider === "google_drive") {
    const encryptedRefresh = connection.refresh_token_encrypted || connection.access_token_encrypted;
    const accessToken = await getPersonalGoogleAccessToken(encryptedRefresh);
    const uploaded = await uploadPersonalDriveFile(accessToken, folder, storedName, mimeType, bytes);
    return { provider: "google_drive", externalFileId: uploaded.id };
  }

  const accessToken = await getPersonalOneDriveAccessToken(connection, dbClient);
  const uploaded = await uploadProjectOneDriveFile(accessToken, folder, storedName, mimeType, bytes);
  return { provider: "onedrive", externalFileId: uploaded.id };
}

export async function downloadChatFileFromPersonalCloud(
  dbClient: SupabaseClient,
  ownerUserId: string,
  provider: PersonalCloudProvider,
  externalFileId: string
): Promise<Buffer> {
  const { data: conn, error } = await dbClient
    .from("user_cloud_connections")
    .select("id, user_id, provider, account_email, access_token_encrypted, refresh_token_encrypted, folder_name, is_active, connected_at, updated_at")
    .eq("user_id", ownerUserId)
    .eq("provider", provider)
    .maybeSingle();

  if (error || !conn) {
    throw new Error("Sender's cloud storage connection is no longer available.");
  }

  const row = conn as UserCloudConnectionRow;
  if (provider === "google_drive") {
    const encryptedRefresh = row.refresh_token_encrypted || row.access_token_encrypted;
    const accessToken = await getPersonalGoogleAccessToken(encryptedRefresh);
    const { buffer } = await getDriveFile(accessToken, externalFileId);
    return buffer;
  }

  const accessToken = await getPersonalOneDriveAccessToken(row, dbClient);
  const { buffer } = await getOneDriveFile(accessToken, externalFileId);
  return buffer;
}
