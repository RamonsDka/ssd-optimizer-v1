"use client";

// ─── MigrationWrapper ─────────────────────────────────────────────────────────
// Client component that runs data migration on mount.
// This ensures legacy localStorage data is migrated to session-scoped format.

import { useEffect } from "react";
import { migrateLegacyData } from "@/lib/session/migrate-legacy-data";

export function MigrationWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Run migration once on mount
    migrateLegacyData();
  }, []);

  return <>{children}</>;
}
