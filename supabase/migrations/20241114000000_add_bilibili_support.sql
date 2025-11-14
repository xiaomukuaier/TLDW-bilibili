-- ============================================================================
-- Bilibili Support Migration
-- ============================================================================
-- This migration adds support for Bilibili video analysis alongside existing YouTube support
-- ============================================================================

-- ============================================================================
-- SECTION 1: NEW TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: bilibili_video_analyses
-- Purpose: Cached Bilibili video analysis data with AI-generated content
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bilibili_video_analyses (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    bvid text UNIQUE, -- Bilibili BV ID format
    aid text, -- Bilibili AV ID format (legacy)
    title text NOT NULL,
    author text,
    duration integer NOT NULL,
    thumbnail_url text,
    transcript jsonb NOT NULL,
    topics jsonb,
    summary jsonb,
    suggested_questions jsonb,
    model_used text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT bilibili_video_analyses_bvid_aid_check CHECK (
        (bvid IS NOT NULL AND aid IS NULL) OR
        (bvid IS NULL AND aid IS NOT NULL) OR
        (bvid IS NOT NULL AND aid IS NOT NULL)
    )
);

COMMENT ON TABLE public.bilibili_video_analyses IS 'Cached Bilibili video analysis data with AI-generated highlights and summaries';
COMMENT ON COLUMN public.bilibili_video_analyses.transcript IS 'Full video transcript with timestamps (JSON array)';
COMMENT ON COLUMN public.bilibili_video_analyses.topics IS 'AI-generated highlight reels (JSON array)';
COMMENT ON COLUMN public.bilibili_video_analyses.summary IS 'AI-generated video summary (JSON object)';
COMMENT ON COLUMN public.bilibili_video_analyses.suggested_questions IS 'AI-generated discussion questions (JSON array)';

-- ============================================================================
-- SECTION 2: INDEXES
-- ============================================================================

-- Bilibili video analyses indexes
CREATE INDEX IF NOT EXISTS idx_bilibili_video_analyses_bvid ON public.bilibili_video_analyses(bvid);
CREATE INDEX IF NOT EXISTS idx_bilibili_video_analyses_aid ON public.bilibili_video_analyses(aid);
CREATE INDEX IF NOT EXISTS idx_bilibili_video_analyses_created_at ON public.bilibili_video_analyses(created_at);

-- ============================================================================
-- SECTION 3: FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: upsert_bilibili_video_analysis
-- Purpose: Insert or update Bilibili video analysis
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_bilibili_video_analysis(
    p_bvid text DEFAULT NULL,
    p_aid text DEFAULT NULL,
    p_title text,
    p_author text,
    p_duration integer,
    p_thumbnail_url text,
    p_transcript jsonb,
    p_topics jsonb,
    p_summary jsonb,
    p_suggested_questions jsonb,
    p_model_used text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_video_id uuid;
BEGIN
    -- Validate that at least one ID is provided
    IF p_bvid IS NULL AND p_aid IS NULL THEN
        RAISE EXCEPTION 'Either bvid or aid must be provided';
    END IF;

    -- Insert or update video analysis
    INSERT INTO public.bilibili_video_analyses (
        bvid,
        aid,
        title,
        author,
        duration,
        thumbnail_url,
        transcript,
        topics,
        summary,
        suggested_questions,
        model_used
    ) VALUES (
        p_bvid,
        p_aid,
        p_title,
        p_author,
        p_duration,
        p_thumbnail_url,
        p_transcript,
        p_topics,
        p_summary,
        p_suggested_questions,
        p_model_used
    )
    ON CONFLICT (bvid) DO UPDATE SET
        topics = COALESCE(EXCLUDED.topics, bilibili_video_analyses.topics),
        summary = COALESCE(EXCLUDED.summary, bilibili_video_analyses.summary),
        suggested_questions = COALESCE(EXCLUDED.suggested_questions, bilibili_video_analyses.suggested_questions),
        updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_video_id;

    RETURN v_video_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- Function: get_video_analysis_by_platform
-- Purpose: Get video analysis by platform and video ID
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_video_analysis_by_platform(
    p_platform text,
    p_video_id text
)
RETURNS TABLE (
    id uuid,
    title text,
    author text,
    duration integer,
    thumbnail_url text,
    transcript jsonb,
    topics jsonb,
    summary jsonb,
    suggested_questions jsonb,
    model_used text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    platform text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_platform = 'youtube' THEN
        RETURN QUERY
        SELECT
            va.id,
            va.title,
            va.author,
            va.duration,
            va.thumbnail_url,
            va.transcript,
            va.topics,
            va.summary,
            va.suggested_questions,
            va.model_used,
            va.created_at,
            va.updated_at,
            'youtube'::text as platform
        FROM public.video_analyses va
        WHERE va.youtube_id = p_video_id;
    ELSIF p_platform = 'bilibili' THEN
        RETURN QUERY
        SELECT
            bva.id,
            bva.title,
            bva.author,
            bva.duration,
            bva.thumbnail_url,
            bva.transcript,
            bva.topics,
            bva.summary,
            bva.suggested_questions,
            bva.model_used,
            bva.created_at,
            bva.updated_at,
            'bilibili'::text as platform
        FROM public.bilibili_video_analyses bva
        WHERE bva.bvid = p_video_id OR bva.aid = p_video_id;
    ELSE
        RAISE EXCEPTION 'Unsupported platform: %', p_platform;
    END IF;
END;
$$;

-- ============================================================================
-- SECTION 4: TRIGGERS
-- ============================================================================

-- Trigger: Auto-update updated_at on bilibili_video_analyses
DROP TRIGGER IF EXISTS update_bilibili_video_analyses_updated_at ON public.bilibili_video_analyses;
CREATE TRIGGER update_bilibili_video_analyses_updated_at
    BEFORE UPDATE ON public.bilibili_video_analyses
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- SECTION 5: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.bilibili_video_analyses ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- RLS Policies: bilibili_video_analyses
-- ----------------------------------------------------------------------------

-- Anyone can view Bilibili video analyses (public read)
CREATE POLICY "Anyone can view Bilibili video analyses" ON public.bilibili_video_analyses
    FOR SELECT
    USING (true);

-- Authenticated users can insert Bilibili video analyses
CREATE POLICY "Authenticated users can insert Bilibili video analyses" ON public.bilibili_video_analyses
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update Bilibili video analyses
CREATE POLICY "Authenticated users can update Bilibili video analyses" ON public.bilibili_video_analyses
    FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Service role can manage all Bilibili video analyses
CREATE POLICY "Service role full access to Bilibili video analyses" ON public.bilibili_video_analyses
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- This migration adds support for Bilibili video analysis alongside existing YouTube support.
-- It creates a separate table for Bilibili videos while maintaining the existing YouTube structure.
--
-- After applying this migration, verify:
-- 1. The bilibili_video_analyses table is created with correct columns and constraints
-- 2. All indexes are created for optimal query performance
-- 3. All functions are callable and work as expected
-- 4. The trigger fires correctly on UPDATE operations
-- 5. RLS policies properly restrict access based on user authentication
-- ============================================================================