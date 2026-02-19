-- Parsed tasks table for storing PLC task configuration data
CREATE TABLE IF NOT EXISTS parsed_tasks (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    file_id UUID NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
    version_id UUID REFERENCES file_versions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    rate INTEGER,
    priority INTEGER NOT NULL DEFAULT 10,
    watchdog INTEGER,
    inhibit_task BOOLEAN DEFAULT FALSE,
    disable_update_outputs BOOLEAN DEFAULT FALSE,
    description TEXT,
    scheduled_programs TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_parsed_tasks_file ON parsed_tasks(file_id);
CREATE INDEX idx_parsed_tasks_version_id ON parsed_tasks(version_id);

-- Enable RLS
ALTER TABLE parsed_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies (matching existing parsed_* table pattern)
CREATE POLICY "Users can view tasks from their project files"
    ON parsed_tasks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_files
            JOIN projects ON projects.id = project_files.project_id
            JOIN organization_members ON organization_members.organization_id = projects.organization_id
            WHERE project_files.id = parsed_tasks.file_id
            AND organization_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert tasks for their project files"
    ON parsed_tasks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM project_files
            JOIN projects ON projects.id = project_files.project_id
            JOIN organization_members ON organization_members.organization_id = projects.organization_id
            WHERE project_files.id = parsed_tasks.file_id
            AND organization_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete tasks from their project files"
    ON parsed_tasks FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM project_files
            JOIN projects ON projects.id = project_files.project_id
            JOIN organization_members ON organization_members.organization_id = projects.organization_id
            WHERE project_files.id = parsed_tasks.file_id
            AND organization_members.user_id = auth.uid()
        )
    );

-- Allow shared project access (matching pattern from share policies)
CREATE POLICY "Shared users can view tasks"
    ON parsed_tasks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_files
            JOIN project_shares ON project_shares.project_id = project_files.project_id
            WHERE project_files.id = parsed_tasks.file_id
            AND project_shares.shared_with_user_id = auth.uid()
            AND project_shares.accepted_at IS NOT NULL
        )
    );
