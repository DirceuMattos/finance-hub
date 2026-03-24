export interface FinancialEntity {
  id: string;
  name: string;
  entity_type: string;
  is_primary_business_entity: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  name: string;
  bank_name: string | null;
  account_type: string;
  financial_entity_id: string;
  opening_balance: number;
  current_balance: number;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  financial_entities?: { name: string };
}

export interface Card {
  id: string;
  name: string;
  issuer_bank: string | null;
  credit_limit: number;
  managerial_limit: number | null;
  closing_day: number;
  due_day: number;
  financial_entity_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  financial_entities?: { name: string };
}

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  category_group: string | null;
  transaction_nature: string | null;
  is_containable: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  parent?: { name: string } | null;
}

export interface SystemParameter {
  id: string;
  parameter_key: string;
  parameter_value: string;
  value_type: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  description: string;
  notes: string | null;
  transaction_type: string;
  category_id: string | null;
  financial_entity_id: string;
  account_id: string | null;
  amount: number;
  competence_date: string;
  due_date: string | null;
  payment_date: string | null;
  status: string;
  installment_number: number | null;
  installment_total: number | null;
  payment_method: string | null;
  source_type: string | null;
  source_id: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  categories?: { name: string } | null;
  financial_entities?: { name: string };
  accounts?: { name: string } | null;
}

export interface CardPurchase {
  id: string;
  description: string;
  notes: string | null;
  card_id: string;
  category_id: string | null;
  financial_entity_id: string;
  purchase_date: string;
  first_billing_month: string;
  total_amount: number;
  installments_count: number;
  installment_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  cards?: { name: string };
  categories?: { name: string } | null;
  financial_entities?: { name: string };
}

export interface CardInstallment {
  id: string;
  card_purchase_id: string;
  installment_number: number;
  billing_month: string;
  due_date: string;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
}
