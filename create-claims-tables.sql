-- Script to create the expense claims tables

-- Create the expense_claims table
CREATE TABLE IF NOT EXISTS expense_claims (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type TEXT NOT NULL,
    document_number TEXT NOT NULL,
    claim_for_month_of DATE,
    staff_name TEXT NOT NULL,
    staff_no TEXT NOT NULL,
    gred TEXT,
    staff_type TEXT,
    executive_status TEXT,
    department_code TEXT,
    dept_cost_center_code TEXT,
    location TEXT,
    tel_ext TEXT,
    start_time_from_home TEXT,
    time_of_arrival_at_home TEXT,
    bank_name TEXT,
    account_number TEXT,
    purpose_of_claim TEXT,
    is_medical_claim BOOLEAN DEFAULT FALSE,
    applicable_medical_type TEXT,
    is_for_family BOOLEAN DEFAULT FALSE,
    family_member_spouse BOOLEAN DEFAULT FALSE,
    family_member_children BOOLEAN DEFAULT FALSE,
    family_member_other TEXT,
    total_advance_claim_amount NUMERIC(10, 2) DEFAULT 0,
    less_advance_taken NUMERIC(10, 2) DEFAULT 0,
    less_corporate_credit_card_payment NUMERIC(10, 2) DEFAULT 0,
    balance_claim_repayment NUMERIC(10, 2) DEFAULT 0,
    cheque_receipt_no TEXT,
    i_declare BOOLEAN DEFAULT FALSE,
    declaration_date DATE,
    status TEXT DEFAULT 'Pending Verification',
    trf_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the expense_claim_items table
CREATE TABLE IF NOT EXISTS expense_claim_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id TEXT NOT NULL REFERENCES expense_claims(id) ON DELETE CASCADE,
    item_date DATE,
    claim_or_travel_details TEXT,
    official_mileage_km NUMERIC(10, 2) DEFAULT 0,
    transport NUMERIC(10, 2) DEFAULT 0,
    hotel_accommodation_allowance NUMERIC(10, 2) DEFAULT 0,
    out_station_allowance_meal NUMERIC(10, 2) DEFAULT 0,
    miscellaneous_allowance_10_percent NUMERIC(10, 2) DEFAULT 0,
    other_expenses NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the expense_claim_fx_rates table
CREATE TABLE IF NOT EXISTS expense_claim_fx_rates (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id TEXT NOT NULL REFERENCES expense_claims(id) ON DELETE CASCADE,
    fx_date DATE,
    type_of_currency TEXT,
    selling_rate_tt_od NUMERIC(10, 4) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_expense_claim_items_claim_id ON expense_claim_items(claim_id);
CREATE INDEX IF NOT EXISTS idx_expense_claim_fx_rates_claim_id ON expense_claim_fx_rates(claim_id);
CREATE INDEX IF NOT EXISTS idx_expense_claims_staff_no ON expense_claims(staff_no);
CREATE INDEX IF NOT EXISTS idx_expense_claims_status ON expense_claims(status);

-- Create a function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update the updated_at column
DROP TRIGGER IF EXISTS update_expense_claims_updated_at ON expense_claims;
CREATE TRIGGER update_expense_claims_updated_at
BEFORE UPDATE ON expense_claims
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expense_claim_items_updated_at ON expense_claim_items;
CREATE TRIGGER update_expense_claim_items_updated_at
BEFORE UPDATE ON expense_claim_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expense_claim_fx_rates_updated_at ON expense_claim_fx_rates;
CREATE TRIGGER update_expense_claim_fx_rates_updated_at
BEFORE UPDATE ON expense_claim_fx_rates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
