import type { ProjectApprovals, Store } from "@/types";
import { emptyApprovals } from "@/types";

export function mapApprovalsFromDb(row: Record<string, unknown>): ProjectApprovals {
  return {
    architectural: {
      approved: Boolean(row.architectural_approved),
      approvedBy: (row.architectural_approved_by as string) || undefined,
      approvedByName:
        (row.architectural_approved_by_name as string) || undefined,
      approvedAt: (row.architectural_approved_at as string) || undefined,
    },
    mechanical: {
      approved: Boolean(row.mechanical_approved),
      approvedBy: (row.mechanical_approved_by as string) || undefined,
      approvedByName: (row.mechanical_approved_by_name as string) || undefined,
      approvedAt: (row.mechanical_approved_at as string) || undefined,
    },
    electrical: {
      approved: Boolean(row.electrical_approved),
      approvedBy: (row.electrical_approved_by as string) || undefined,
      approvedByName: (row.electrical_approved_by_name as string) || undefined,
      approvedAt: (row.electrical_approved_at as string) || undefined,
    },
    projectOpened: Boolean(row.project_opened),
    projectOpenedBy: (row.project_opened_by as string) || undefined,
    projectOpenedByName: (row.project_opened_by_name as string) || undefined,
    projectOpenedAt: (row.project_opened_at as string) || undefined,
  };
}

export function approvalsToDb(approvals: ProjectApprovals): Record<string, unknown> {
  return {
    architectural_approved: approvals.architectural.approved,
    architectural_approved_by: approvals.architectural.approvedBy ?? null,
    architectural_approved_by_name:
      approvals.architectural.approvedByName ?? null,
    architectural_approved_at: approvals.architectural.approvedAt ?? null,
    mechanical_approved: approvals.mechanical.approved,
    mechanical_approved_by: approvals.mechanical.approvedBy ?? null,
    mechanical_approved_by_name: approvals.mechanical.approvedByName ?? null,
    mechanical_approved_at: approvals.mechanical.approvedAt ?? null,
    electrical_approved: approvals.electrical.approved,
    electrical_approved_by: approvals.electrical.approvedBy ?? null,
    electrical_approved_by_name: approvals.electrical.approvedByName ?? null,
    electrical_approved_at: approvals.electrical.approvedAt ?? null,
    project_opened: approvals.projectOpened,
    project_opened_by: approvals.projectOpenedBy ?? null,
    project_opened_by_name: approvals.projectOpenedByName ?? null,
    project_opened_at: approvals.projectOpenedAt ?? null,
  };
}

export function mapStoreFromDb(s: Record<string, any>): Store {
  return {
    id: s.id,
    organizationId: s.organization_id || undefined,
    name: s.name,
    city: s.city,
    address: s.address,
    latitude: s.latitude,
    longitude: s.longitude,
    projectStatus: s.project_status,
    openingDate: s.opening_date,
    acceptanceDate: s.acceptance_date,
    contractorCompany: s.contractor_company,
    siteManager: s.site_manager,
    locationType: s.location_type,
    grossM2: s.gross_m2,
    floorCount: s.floor_count,
    phone: s.phone,
    isCustom: s.is_custom,
    totalBudget: Number(s.total_budget || 0),
    approvals: mapApprovalsFromDb(s),
    createdBy: s.created_by,
    createdByName: s.created_by_name,
    createdAt: s.created_at,
    updatedBy: s.updated_by,
    updatedByName: s.updated_by_name,
    updatedAt: s.updated_at,
  };
}

export function ensureApprovals(store: Partial<Store>): ProjectApprovals {
  return store.approvals ?? emptyApprovals();
}
