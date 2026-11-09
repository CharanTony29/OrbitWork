import type { SupabaseClient } from "@supabase/supabase-js";

export type StorageProviderType = "local" | "google_drive" | "onedrive" | "sharepoint";

export type WorkspaceStorageInfo = {
  activeProvider: StorageProviderType;
  local: {
    enabled: boolean;
    name: string;
    description: string;
  };
  googleDrive: {
    connected: boolean;
    accountEmail: string | null;
    folderName: string | null;
    connectedAt: string | null;
  };
  oneDrive: {
    connected: boolean;
    hasOauth: boolean;
    accountEmail: string | null;
    folderName: string | null;
    tenantId: string | null;
    clientId: string | null;
    connectedAt: string | null;
  };
  sharePoint: {
    connected: boolean;
    siteUrl: string | null;
    libraryName: string | null;
    folderName: string | null;
    accountEmail: string | null;
    tenantId: string | null;
    clientId: string | null;
    connectedAt: string | null;
  };
};

export type OrganizationStorageInfo = {
  activeProvider: StorageProviderType;
  local: {
    enabled: boolean;
    name: string;
    description: string;
  };
  googleDrive: {
    connected: boolean;
    accountEmail: string | null;
    folderName: string | null;
    connectedAt: string | null;
  };
  oneDrive: {
    connected: boolean;
    hasOauth: boolean;
    accountEmail: string | null;
    folderName: string | null;
    tenantId: string | null;
    clientId: string | null;
    connectedAt: string | null;
  };
  sharePoint: {
    connected: boolean;
    siteUrl: string | null;
    libraryName: string | null;
    folderName: string | null;
    accountEmail: string | null;
    tenantId: string | null;
    clientId: string | null;
    connectedAt: string | null;
  };
};

export async function getWorkspaceStorageConfig(
  supabase: SupabaseClient,
  workspaceId: string,
  organizationId?: string
): Promise<WorkspaceStorageInfo> {
  let driveConnection: {
    account_email: string | null;
    folder_name: string | null;
    connected_at: string;
  } | null = null;

  try {
    const { data: gdc } = await supabase
      .from("google_drive_connections")
      .select("account_email, folder_name, connected_at")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    driveConnection = gdc;
  } catch {
    // Ignore
  }

  if (!driveConnection && organizationId) {
    try {
      const { data: orgGdc } = await supabase
        .from("google_drive_connections")
        .select("account_email, folder_name, connected_at")
        .eq("organization_id", organizationId)
        .is("workspace_id", null)
        .maybeSingle();
      driveConnection = orgGdc;
    } catch {
      // Ignore
    }
  }

  let dbConfig: {
    active_provider?: string;
    onedrive_connected?: boolean;
    onedrive_account_email?: string | null;
    onedrive_folder?: string | null;
    onedrive_tenant_id?: string | null;
    onedrive_client_id?: string | null;
    onedrive_connected_at?: string | null;
    sharepoint_connected?: boolean;
    sharepoint_site_url?: string | null;
    sharepoint_library_name?: string | null;
    sharepoint_folder?: string | null;
    sharepoint_account_email?: string | null;
    sharepoint_tenant_id?: string | null;
    sharepoint_client_id?: string | null;
    sharepoint_connected_at?: string | null;
  } | null = null;

  try {
    const { data: cfg } = await supabase
      .from("workspace_storage_configs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    dbConfig = cfg;
  } catch {
    // Ignore
  }

  let activeProvider: StorageProviderType = "local";
  if (
    dbConfig?.active_provider &&
    ["local", "google_drive", "onedrive", "sharepoint"].includes(dbConfig.active_provider)
  ) {
    activeProvider = dbConfig.active_provider as StorageProviderType;
  } else if (driveConnection) {
    activeProvider = "google_drive";
  }

  return {
    activeProvider,
    local: {
      enabled: true,
      name: "Local Storage (Built-in)",
      description: "Fast, zero-setup storage inside Orbitwork. Files are isolated to this workspace.",
    },
    googleDrive: {
      connected: Boolean(driveConnection),
      accountEmail: driveConnection?.account_email ?? null,
      folderName: driveConnection?.folder_name ?? null,
      connectedAt: driveConnection?.connected_at ?? null,
    },
    oneDrive: {
      connected: Boolean(dbConfig?.onedrive_connected),
      hasOauth: Boolean((dbConfig as any)?.onedrive_refresh_token_ciphertext),
      accountEmail: dbConfig?.onedrive_account_email ?? null,
      folderName: dbConfig?.onedrive_folder ?? null,
      tenantId: dbConfig?.onedrive_tenant_id ?? null,
      clientId: dbConfig?.onedrive_client_id ?? null,
      connectedAt: dbConfig?.onedrive_connected_at ?? null,
    },
    sharePoint: {
      connected: Boolean(dbConfig?.sharepoint_connected),
      siteUrl: dbConfig?.sharepoint_site_url ?? null,
      libraryName: dbConfig?.sharepoint_library_name ?? null,
      folderName: dbConfig?.sharepoint_folder ?? null,
      accountEmail: dbConfig?.sharepoint_account_email ?? null,
      tenantId: dbConfig?.sharepoint_tenant_id ?? null,
      clientId: dbConfig?.sharepoint_client_id ?? null,
      connectedAt: dbConfig?.sharepoint_connected_at ?? null,
    },
  };
}

export async function getOrganizationStorageConfig(
  supabase: SupabaseClient,
  organizationId: string
): Promise<OrganizationStorageInfo> {
  let driveConnection: {
    account_email: string | null;
    folder_name: string | null;
    connected_at: string;
  } | null = null;

  try {
    const { data: orgGdc } = await supabase
      .from("google_drive_connections")
      .select("account_email, folder_name, connected_at")
      .eq("organization_id", organizationId)
      .is("workspace_id", null)
      .maybeSingle();
    driveConnection = orgGdc;
  } catch {
    // Ignore
  }

  let dbConfig: {
    active_provider?: string;
    onedrive_connected?: boolean;
    onedrive_account_email?: string | null;
    onedrive_folder?: string | null;
    onedrive_tenant_id?: string | null;
    onedrive_client_id?: string | null;
    onedrive_connected_at?: string | null;
    sharepoint_connected?: boolean;
    sharepoint_site_url?: string | null;
    sharepoint_library_name?: string | null;
    sharepoint_folder?: string | null;
    sharepoint_account_email?: string | null;
    sharepoint_tenant_id?: string | null;
    sharepoint_client_id?: string | null;
    sharepoint_connected_at?: string | null;
  } | null = null;

  try {
    const { data: cfg } = await supabase
      .from("organization_storage_configs")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();
    dbConfig = cfg;
  } catch {
    // Ignore
  }

  let activeProvider: StorageProviderType = "local";
  if (
    dbConfig?.active_provider &&
    ["local", "google_drive", "onedrive", "sharepoint"].includes(dbConfig.active_provider)
  ) {
    activeProvider = dbConfig.active_provider as StorageProviderType;
  } else if (driveConnection) {
    activeProvider = "google_drive";
  }

  return {
    activeProvider,
    local: {
      enabled: true,
      name: "Local Storage (Built-in)",
      description: "Default high-speed storage managed on the server.",
    },
    googleDrive: {
      connected: Boolean(driveConnection),
      accountEmail: driveConnection?.account_email ?? null,
      folderName: driveConnection?.folder_name ?? null,
      connectedAt: driveConnection?.connected_at ?? null,
    },
    oneDrive: {
      connected: Boolean(dbConfig?.onedrive_connected),
      hasOauth: Boolean((dbConfig as any)?.onedrive_refresh_token_ciphertext),
      accountEmail: dbConfig?.onedrive_account_email ?? null,
      folderName: dbConfig?.onedrive_folder ?? null,
      tenantId: dbConfig?.onedrive_tenant_id ?? null,
      clientId: dbConfig?.onedrive_client_id ?? null,
      connectedAt: dbConfig?.onedrive_connected_at ?? null,
    },
    sharePoint: {
      connected: Boolean(dbConfig?.sharepoint_connected),
      siteUrl: dbConfig?.sharepoint_site_url ?? null,
      libraryName: dbConfig?.sharepoint_library_name ?? null,
      folderName: dbConfig?.sharepoint_folder ?? null,
      accountEmail: dbConfig?.sharepoint_account_email ?? null,
      tenantId: dbConfig?.sharepoint_tenant_id ?? null,
      clientId: dbConfig?.sharepoint_client_id ?? null,
      connectedAt: dbConfig?.sharepoint_connected_at ?? null,
    },
  };
}
