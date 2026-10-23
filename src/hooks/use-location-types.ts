"use client";

import { useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/auth-context";
import { getLocationTypeLabel, organizationLocationTypes } from "@/lib/location-types";

/** Firmanın saha türleri ve anahtar → ad çevirisi */
export function useLocationTypes() {
  const { organization } = useAuth();
  const types = useMemo(() => organizationLocationTypes(organization), [organization]);
  const label = useCallback((key: string) => getLocationTypeLabel(key, types), [types]);
  return { types, label };
}
