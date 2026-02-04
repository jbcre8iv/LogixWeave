-- LogixWeave Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization members (join table)
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project files table
CREATE TABLE project_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('l5x', 'l5k')),
    file_size INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    parsing_status TEXT NOT NULL DEFAULT 'pending' CHECK (parsing_status IN ('pending', 'processing', 'completed', 'failed')),
    parsing_error TEXT,
    uploaded_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parsed tags table
CREATE TABLE parsed_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data_type TEXT NOT NULL,
    scope TEXT NOT NULL,
    description TEXT,
    value TEXT,
    alias_for TEXT,
    usage TEXT,
    radix TEXT,
    external_access TEXT,
    dimensions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parsed I/O modules table
CREATE TABLE parsed_io_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    catalog_number TEXT,
    parent_module TEXT,
    slot INTEGER,
    connection_info JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parsed routines table
CREATE TABLE parsed_routines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    program_name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    rung_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_organization_members_org ON organization_members(organization_id);
CREATE INDEX idx_organization_members_user ON organization_members(user_id);
CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_project_files_project ON project_files(project_id);
CREATE INDEX idx_parsed_tags_file ON parsed_tags(file_id);
CREATE INDEX idx_parsed_tags_name ON parsed_tags(name);
CREATE INDEX idx_parsed_tags_scope ON parsed_tags(scope);
CREATE INDEX idx_parsed_tags_data_type ON parsed_tags(data_type);
CREATE INDEX idx_parsed_io_modules_file ON parsed_io_modules(file_id);
CREATE INDEX idx_parsed_routines_file ON parsed_routines(file_id);

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsed_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsed_io_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsed_routines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- RLS Policies for organizations
CREATE POLICY "Users can view organizations they belong to"
    ON organizations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = organizations.id
            AND organization_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create organizations"
    ON organizations FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Organization owners and admins can update"
    ON organizations FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = organizations.id
            AND organization_members.user_id = auth.uid()
            AND organization_members.role IN ('owner', 'admin')
        )
    );

-- RLS Policies for organization_members
CREATE POLICY "Users can view members of their organizations"
    ON organization_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = organization_members.organization_id
            AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can add themselves to organizations"
    ON organization_members FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Organization owners can manage members"
    ON organization_members FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = organization_members.organization_id
            AND om.user_id = auth.uid()
            AND om.role = 'owner'
        )
    );

-- RLS Policies for projects
CREATE POLICY "Users can view projects in their organizations"
    ON projects FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = projects.organization_id
            AND organization_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create projects in their organizations"
    ON projects FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = projects.organization_id
            AND organization_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update projects in their organizations"
    ON projects FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = projects.organization_id
            AND organization_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete projects in their organizations"
    ON projects FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = projects.organization_id
            AND organization_members.user_id = auth.uid()
            AND organization_members.role IN ('owner', 'admin')
        )
    );

-- RLS Policies for project_files
CREATE POLICY "Users can view files in their projects"
    ON project_files FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            JOIN organization_members ON organization_members.organization_id = projects.organization_id
            WHERE projects.id = project_files.project_id
            AND organization_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can upload files to their projects"
    ON project_files FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            JOIN organization_members ON organization_members.organization_id = projects.organization_id
            WHERE projects.id = project_files.project_id
            AND organization_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update files in their projects"
    ON project_files FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            JOIN organization_members ON organization_members.organization_id = projects.organization_id
            WHERE projects.id = project_files.project_id
            AND organization_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete files in their projects"
    ON project_files FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            JOIN organization_members ON organization_members.organization_id = projects.organization_id
            WHERE projects.id = project_files.project_id
            AND organization_members.user_id = auth.uid()
        )
    );

-- RLS Policies for parsed_tags
CREATE POLICY "Users can view tags from their project files"
    ON parsed_tags FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_files
            JOIN projects ON projects.id = project_files.project_id
            JOIN organization_members ON organization_members.organization_id = projects.organization_id
            WHERE project_files.id = parsed_tags.file_id
            AND organization_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert tags for their project files"
    ON parsed_tags FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM project_files
            JOIN projects ON projects.id = project_files.project_id
            JOIN organization_members ON organization_members.organization_id = projects.organization_id
            WHERE project_files.id = parsed_tags.file_id
            AND organization_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete tags from their project files"
    ON parsed_tags FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM project_files
            JOIN projects ON projects.id = project_files.project_id
            JOIN organization_members ON organization_members.organization_id = projects.organization_id
            WHERE project_files.id = parsed_tags.file_id
            AND organization_members.user_id = auth.uid()
        )
    );

-- RLS Policies for parsed_io_modules
CREATE POLICY "Users can view IO modules from their project files"
    ON parsed_io_modules FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_files
            JOIN projects ON projects.id = project_files.project_id
            JOIN organization_members ON organization_members.organization_id = projects.organization_id
            WHERE project_files.id = parsed_io_modules.file_id
            AND organization_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert IO modules for their project files"
    ON parsed_io_modules FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM project_files
            JOIN projects ON projects.id = project_files.project_id
            JOIN organization_members ON organization_members.organization_id = projects.organization_id
            WHERE project_files.id = parsed_io_modules.file_id
            AND organization_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete IO modules from their project files"
    ON parsed_io_modules FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM project_files
            JOIN projects ON projects.id = project_files.project_id
            JOIN organization_members ON organization_members.organization_id = projects.organization_id
            WHERE project_files.id = parsed_io_modules.file_id
            AND organization_members.user_id = auth.uid()
        )
    );

-- RLS Policies for parsed_routines
CREATE POLICY "Users can view routines from their project files"
    ON parsed_routines FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_files
            JOIN projects ON projects.id = project_files.project_id
            JOIN organization_members ON organization_members.organization_id = projects.organization_id
            WHERE project_files.id = parsed_routines.file_id
            AND organization_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert routines for their project files"
    ON parsed_routines FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM project_files
            JOIN projects ON projects.id = project_files.project_id
            JOIN organization_members ON organization_members.organization_id = projects.organization_id
            WHERE project_files.id = parsed_routines.file_id
            AND organization_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete routines from their project files"
    ON parsed_routines FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM project_files
            JOIN projects ON projects.id = project_files.project_id
            JOIN organization_members ON organization_members.organization_id = projects.organization_id
            WHERE project_files.id = parsed_routines.file_id
            AND organization_members.user_id = auth.uid()
        )
    );

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_files_updated_at
    BEFORE UPDATE ON project_files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket for project files
-- NOTE: Create this bucket manually in Supabase Dashboard: Storage > New bucket > "project-files" (private)
-- Or run this if using Supabase CLI:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('project-files', 'project-files', false);

-- Storage RLS policies (run these after creating the bucket)
-- These policies allow users to access files in their organization's projects

-- Policy for uploading files
CREATE POLICY "Users can upload files to their projects"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'project-files' AND
    auth.uid() IS NOT NULL
);

-- Policy for reading files
CREATE POLICY "Users can read files from their projects"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'project-files' AND
    auth.uid() IS NOT NULL
);

-- Policy for deleting files
CREATE POLICY "Users can delete files from their projects"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'project-files' AND
    auth.uid() IS NOT NULL
);
