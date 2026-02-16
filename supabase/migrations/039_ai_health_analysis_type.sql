-- Migration: Add 'health' to ai_analysis_cache analysis_type CHECK constraint
-- Enables caching of AI health recommendation results

ALTER TABLE ai_analysis_cache DROP CONSTRAINT ai_analysis_cache_analysis_type_check;
ALTER TABLE ai_analysis_cache ADD CONSTRAINT ai_analysis_cache_analysis_type_check
  CHECK (analysis_type IN ('explain', 'issues', 'search', 'health'));
