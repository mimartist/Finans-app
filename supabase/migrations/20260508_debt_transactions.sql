CREATE TABLE IF NOT EXISTS debt_transactions (
  id SERIAL PRIMARY KEY,
  debt_id INTEGER NOT NULL REFERENCES debt_records(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('tahsilat', 'ilave', 'ilk_tutar')),
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'TRY',
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_debt_transactions_debt_id ON debt_transactions(debt_id);

ALTER TABLE debt_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own debt transactions" ON debt_transactions
  FOR ALL USING (auth.uid() = user_id);
