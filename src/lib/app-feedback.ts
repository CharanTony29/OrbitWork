"use client";

export type AppToastType = "info" | "success" | "warning" | "error";

export interface AppToastDetail {
  id: string;
  message: string;
  title?: string;
  type: AppToastType;
  actionLabel?: string;
  actionHref?: string;
  durationMs?: number;
}

export interface AppConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface AppPromptOptions {
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface AppConfirmRequest {
  id: string;
  options: AppConfirmOptions;
  resolve: (accepted: boolean) => void;
}

export interface AppPromptRequest {
  id: string;
  options: AppPromptOptions;
  resolve: (value: string | null) => void;
}

export const APP_TOAST_EVENT = "orbitwork:app-toast";
export const APP_CONFIRM_EVENT = "orbitwork:app-confirm";
export const APP_PROMPT_EVENT = "orbitwork:app-prompt";

export function showAppToast(
  message: string,
  type: AppToastType = "info",
  extra?: { title?: string; actionLabel?: string; actionHref?: string; durationMs?: number }
): void {
  if (typeof window === "undefined") return;
  const detail: AppToastDetail = {
    id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    type,
    ...extra,
  };
  window.dispatchEvent(new CustomEvent<AppToastDetail>(APP_TOAST_EVENT, { detail }));
}

export function showAppConfirm(
  messageOrOptions: string | AppConfirmOptions
): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const options: AppConfirmOptions =
    typeof messageOrOptions === "string" ? { message: messageOrOptions } : messageOrOptions;
  return new Promise<boolean>((resolve) => {
    const detail: AppConfirmRequest = {
      id: `confirm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      options,
      resolve,
    };
    window.dispatchEvent(new CustomEvent<AppConfirmRequest>(APP_CONFIRM_EVENT, { detail }));
  });
}

export function showAppPrompt(
  messageOrOptions: string | AppPromptOptions
): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const options: AppPromptOptions =
    typeof messageOrOptions === "string" ? { message: messageOrOptions } : messageOrOptions;
  return new Promise<string | null>((resolve) => {
    const detail: AppPromptRequest = {
      id: `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      options,
      resolve,
    };
    window.dispatchEvent(new CustomEvent<AppPromptRequest>(APP_PROMPT_EVENT, { detail }));
  });
}
