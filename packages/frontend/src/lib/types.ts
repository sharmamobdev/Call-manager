export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string;
  role: string;
  organizationId: string;
}

export interface Organization {
  id: string;
  name: string;
  type: string;
  parentOrgId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Number {
  id: string;
  e164: string;
  friendlyName?: string;
  organizationId: string;
  campaignId?: string;
  callVendorId?: string;
  ivrConfig?: any;
  isActive: boolean;
  isTollFree: boolean;
  monthlyRental: string;
  purchasedAt: string;
  assignedAt?: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  status: string;
  a2pBrandId?: string;
  a2pCampaignId?: string;
  useCase?: string;
  monthlyVolume?: number;
  isActive: boolean;
}

export interface Buyer {
  id: string;
  name: string;
  email?: string;
  description?: string;
  organizationId: string;
  isActive: boolean;
}

export interface CallVendor {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface Cdr {
  id: string;
  callSid?: string;
  fromNumber: string;
  toNumber: string;
  direction: string;
  duration: number;
  billDuration: number;
  cost: string;
  rate: string;
  status: string;
  recordingUrl?: string;
  answeredAt?: string;
  endedAt?: string;
  callDate: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  organizationId: string;
  status: string;
  totalAmount: string;
  currency: string;
  dueDate: string;
  paidAt?: string;
}

export interface BillingSummary {
  total_dids: number;
  monthly_rental: string;
  current_balance: string;
  pending_amount: string;
  last_invoice_date?: string;
}
