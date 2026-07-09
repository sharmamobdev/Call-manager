export interface LoginRequest {
  email: string;
  password: string;
  twoFactorCode?: string;
}

export interface CreateOrganizationRequest {
  name: string;
  type: "admin" | "reseller" | "customer";
  parentOrgId?: string;
}

export interface BuyNumberRequest {
  did_ids?: string[];
  area_code?: string;
  quantity?: number;
  toll_free?: boolean;
}

export interface CreateCampaignRequest {
  name: string;
  description?: string;
  useCase?: string;
  sampleMessages?: string[];
  monthlyVolume?: number;
}

export interface CreateInvoiceRequest {
  organizationId: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    itemType: string;
  }[];
  dueDate: string;
  notes?: string;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface CdrQuery extends PaginationQuery {
  fromDate?: string;
  toDate?: string;
  fromNumber?: string;
  toNumber?: string;
  direction?: string;
  status?: string;
}
