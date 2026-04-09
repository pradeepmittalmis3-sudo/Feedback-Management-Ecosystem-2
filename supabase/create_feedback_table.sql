-- Rajmandir Feedback Submissions Table
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

CREATE TABLE IF NOT EXISTS feedback_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  store_location TEXT NOT NULL,
  staff_behavior INT NOT NULL CHECK (staff_behavior BETWEEN 1 AND 5),
  staff_service INT NOT NULL CHECK (staff_service BETWEEN 1 AND 5),
  store_satisfaction INT NOT NULL CHECK (store_satisfaction BETWEEN 1 AND 5),
  price_challenge_ok BOOLEAN NOT NULL DEFAULT true,
  bill_received BOOLEAN NOT NULL DEFAULT true,
  complaint TEXT,
  feedback TEXT,
  suggestions TEXT,
  product_unavailable TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  status_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE feedback_submissions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to INSERT (public form submissions)
CREATE POLICY "Allow public insert" ON feedback_submissions
  FOR INSERT
  WITH CHECK (true);

-- Policy: Allow authenticated users to SELECT all rows (admin dashboard)
CREATE POLICY "Allow authenticated select" ON feedback_submissions
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Allow authenticated users to UPDATE status (admin dashboard)
CREATE POLICY "Allow authenticated update" ON feedback_submissions
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Index for filtering by store and date
CREATE INDEX idx_feedback_store ON feedback_submissions (store_location);
CREATE INDEX idx_feedback_created ON feedback_submissions (created_at DESC);
CREATE INDEX idx_feedback_status ON feedback_submissions (status);
