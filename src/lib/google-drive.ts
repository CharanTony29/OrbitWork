import "server-only";
import { randomUUID, createCipheriv, createDecipheriv } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GoogleDriveFailure = "not_connected" | "configuration" | "reconnect" | "permissions" | "api_disabled" | "quota" | "request_failed";

export class GoogleDriveError extends Error {
  constructor(readonly failure: GoogleDriveFailure, readonly status?: number) {
    super(`Google Drive operation failed: ${failure}${status ? ` (${status})` : ""}`);
    this.name = "GoogleDriveError";
  }
}

function encryptionKey() {
  const encoded = process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY;
  if (!encoded) throw new GoogleDriveError("configuration");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new GoogleDriveError("configuration");
  return key;
}

export function encryptRefreshToken(token: string) {
  const iv = randomUUID().replaceAll("-", "").slice(0, 24);
  const ivBytes = Buffer.from(iv, "hex");
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), ivBytes);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `${ivBytes.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

function decryptRefreshToken(encrypted: string) {
  const [iv, tag, ciphertext] = encrypted.split(".");
  if (!iv || !tag || !ciphertext) throw new Error("Stored Google Drive token is invalid");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export async function googleDriveAccessToken(supabase: SupabaseClient, organizationId: string) {
  const { data: connection, error } = await supabase.from("google_drive_connections").select("refresh_token_ciphertext").eq("organization_id", organizationId).maybeSingle();
  if (error || !connection) throw new GoogleDriveError(error ? "request_failed" : "not_connected");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new GoogleDriveError("configuration");
  const refreshToken = decryptRefreshToken(connection.refresh_token_ciphertext);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    cache: "no-store",
  });
  if (!response.ok) throw new GoogleDriveError("reconnect", response.status);
  const payload = await response.json() as { access_token?: string };
  if (!payload.access_token) throw new Error("Google did not return an access token");
  return payload.access_token;
}

async function driveRequest<T>(accessToken: string, url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${accessToken}`, ...init?.headers }, cache: "no-store" });
  if (!response.ok) {
    let reason = "";
    try {
      const payload = await response.clone().json() as { error?: { message?: string; errors?: { reason?: string }[] } };
      reason = `${payload.error?.message ?? ""} ${payload.error?.errors?.map((item) => item.reason ?? "").join(" ") ?? ""}`.toLowerCase();
    } catch { /* Keep the failure generic when Drive returns a non-JSON body. */ }
    const failure: GoogleDriveFailure = response.status === 401 ? "reconnect"
      : /accessnotconfigured|api has not been used|drive api.*disabled/.test(reason) ? "api_disabled"
      : response.status === 429 || /storagequotaexceeded|quota|user storage/.test(reason) ? "quota"
      : response.status === 403 ? "permissions"
      : "request_failed";
    throw new GoogleDriveError(failure, response.status);
  }
  return response.json() as Promise<T>;
}

async function findFolder(accessToken: string, name: string, parent?: string) {
  const parentFilter = parent ? `'${parent}' in parents and ` : "'root' in parents and ";
  const query = `${parentFilter}name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const result = await driveRequest<{ files?: { id: string }[] }>(accessToken, `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&pageSize=1&fields=files(id)`);
  return result.files?.[0]?.id;
}

async function createFolder(accessToken: string, name: string, parent?: string) {
  const folder = await driveRequest<{ id: string }>(accessToken, "https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", ...(parent ? { parents: [parent] } : {}) }),
  });
  return folder.id;
}

async function getProjectFolder(accessToken: string, projectId: string) {
  const root = await findFolder(accessToken, "Orbitwork") ?? await createFolder(accessToken, "Orbitwork");
  return await findFolder(accessToken, projectId, root) ?? await createFolder(accessToken, projectId, root);
}

export async function uploadProjectDriveFile(accessToken: string, projectId: string, fileName: string, mimeType: string, bytes: Uint8Array) {
  const parent = await getProjectFolder(accessToken, projectId);
  const boundary = `orbitwork_${randomUUID().replaceAll("-", "")}`;
  const metadata = JSON.stringify({ name: fileName, parents: [parent] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    Buffer.from(bytes),
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  return driveRequest<{ id: string; name: string; mimeType: string; size?: string; webViewLink?: string }>(accessToken, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink", {
    method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body,
  });
}

export async function getDriveFile(accessToken: string, fileId: string) {
  const metadata = await driveRequest<{ name: string; mimeType: string }>(accessToken, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=name,mimeType`);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!response.ok) throw new Error("Could not retrieve the Google Drive file");
  const arrayBuffer = await response.arrayBuffer();
  return { metadata, buffer: Buffer.from(arrayBuffer) };
}

export async function deleteDriveFile(accessToken: string, fileId: string) {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!response.ok && response.status !== 404) throw new Error("Could not remove the Google Drive file");
}
