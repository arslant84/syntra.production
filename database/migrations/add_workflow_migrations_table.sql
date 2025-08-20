-- Workflow Migration Management Table
-- Tracks migration from hardcoded to configurable workflows

CREATE TABLE IF NOT EXISTS workflow_migrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module VARCHAR(50) NOT NULL CHECK (module IN ('trf', 'claims', 'visa', 'transport', 'accommodation')),
    workflow_id UUID REFERENCES workflow_templates(id),
    migration_date TIMESTAMP DEFAULT NOW(),
    rollback_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'rolled_back')),
    backup_files JSONB,
    analysis_data JSONB,
    migration_notes TEXT,
    migrated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    INDEX(module),
    INDEX(status),
    INDEX(migration_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_migrations_module_status ON workflow_migrations(module, status);
CREATE INDEX IF NOT EXISTS idx_workflow_migrations_workflow_id ON workflow_migrations(workflow_id);

-- Add triggers for updated_at timestamp
CREATE TRIGGER update_workflow_migrations_updated_at 
    BEFORE UPDATE ON workflow_migrations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_migrations TO authenticated;