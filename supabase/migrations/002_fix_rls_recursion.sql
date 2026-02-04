-- Fix RLS infinite recursion issue
-- Run this in Supabase SQL Editor

-- Create a security definer function to check org membership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = org_id
        AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;
DROP POLICY IF EXISTS "Organization owners can manage members" ON organization_members;
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON organizations;
DROP POLICY IF EXISTS "Organization owners and admins can update" ON organizations;
DROP POLICY IF EXISTS "Users can view projects in their organizations" ON projects;
DROP POLICY IF EXISTS "Users can create projects in their organizations" ON projects;
DROP POLICY IF EXISTS "Users can update projects in their organizations" ON projects;
DROP POLICY IF EXISTS "Users can delete projects in their organizations" ON projects;

-- Recreate organization_members policies without recursion
CREATE POLICY "Users can view their own memberships"
    ON organization_members FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Organization owners can delete members"
    ON organization_members FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = organization_members.organization_id
            AND om.user_id = auth.uid()
            AND om.role = 'owner'
            AND om.user_id != organization_members.user_id  -- Can't delete self via this policy
        )
        OR user_id = auth.uid()  -- Users can remove themselves
    );

-- Recreate organizations policies using the security definer function
CREATE POLICY "Users can view organizations they belong to"
    ON organizations FOR SELECT
    USING (public.is_org_member(id));

CREATE POLICY "Organization owners and admins can update"
    ON organizations FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = organizations.id
            AND user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- Recreate projects policies using the security definer function
CREATE POLICY "Users can view projects in their organizations"
    ON projects FOR SELECT
    USING (public.is_org_member(organization_id));

CREATE POLICY "Users can create projects in their organizations"
    ON projects FOR INSERT
    WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Users can update projects in their organizations"
    ON projects FOR UPDATE
    USING (public.is_org_member(organization_id));

CREATE POLICY "Users can delete projects in their organizations"
    ON projects FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = projects.organization_id
            AND user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );
