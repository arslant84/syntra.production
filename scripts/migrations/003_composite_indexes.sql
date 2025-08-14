-- Add composite indexes for common query patterns found in API analysis

-- Travel requests - status filtering with date sorting (dashboard queries)
CREATE INDEX IF NOT EXISTS idx_travel_requests_status_created_at ON travel_requests(status, created_at DESC);

-- Expense claims - staff and status filtering  
CREATE INDEX IF NOT EXISTS idx_expense_claims_staff_status ON expense_claims(staff_no, status);
CREATE INDEX IF NOT EXISTS idx_expense_claims_status_created_at ON expense_claims(status, created_at DESC);

-- Transport requests - common filtering patterns
CREATE INDEX IF NOT EXISTS idx_transport_requests_status_created_at ON transport_requests(status, created_at DESC);

-- Accommodation bookings - date range queries (calendar view)
CREATE INDEX IF NOT EXISTS idx_accommodation_bookings_date_room ON accommodation_bookings(date, room_id);

-- Approval workflows - step tracking
CREATE INDEX IF NOT EXISTS idx_trf_approval_steps_trf_status ON trf_approval_steps(trf_id, status);

-- User notifications - unread by user with date
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread_date ON user_notifications(user_id, is_read, created_at DESC) WHERE is_read = false;

SELECT 'Composite indexes for query optimization completed' as status;