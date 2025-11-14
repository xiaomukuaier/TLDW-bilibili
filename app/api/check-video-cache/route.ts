import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractVideoId, detectPlatform } from '@/lib/utils';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';

async function handler(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL是必需的' },
        { status: 400 }
      );
    }

    const platform = detectPlatform(url);
    if (!platform) {
      return NextResponse.json(
        { error: '不支持的视频平台。请提供YouTube或Bilibili链接。' },
        { status: 400 }
      );
    }

    // Extract video ID from URL
    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: `无效的${platform === 'youtube' ? 'YouTube' : 'Bilibili'} URL` },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user if logged in
    const { data: { user } } = await supabase.auth.getUser();

    // Check for cached video based on platform
    let cachedVideo: any = null;
    let videoTable = '';

    if (platform === 'youtube') {
      const { data } = await supabase
        .from('video_analyses')
        .select('*')
        .eq('youtube_id', videoId)
        .single();
      cachedVideo = data;
      videoTable = 'video_analyses';
    } else {
      // Bilibili platform
      const { data } = await supabase
        .from('bilibili_video_analyses')
        .select('*')
        .or(`bvid.eq.${videoId},aid.eq.${videoId}`)
        .single();
      cachedVideo = data;
      videoTable = 'bilibili_video_analyses';
    }

    if (cachedVideo && cachedVideo.topics) {
      // If user is logged in, track their access to this video
      if (user) {
        await supabase
          .from('user_videos')
          .upsert({
            user_id: user.id,
            video_id: cachedVideo.id,
            accessed_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,video_id'
          });
      }

      // Return all cached data including transcript and video info
      return NextResponse.json({
        cached: true,
        videoId: videoId,
        platform,
        topics: cachedVideo.topics,
        transcript: cachedVideo.transcript,
        videoInfo: {
          title: cachedVideo.title,
          author: cachedVideo.author,
          duration: cachedVideo.duration,
          thumbnail: cachedVideo.thumbnail_url
        },
        summary: cachedVideo.summary,
        suggestedQuestions: cachedVideo.suggested_questions,
        cacheDate: cachedVideo.created_at
      });
    }

    // Video not cached
    return NextResponse.json({
      cached: false,
      videoId: videoId,
      platform
    });

  } catch (error) {
    console.error('Error checking video cache:', error);
    return NextResponse.json(
      { error: '检查视频缓存失败' },
      { status: 500 }
    );
  }
}

export const POST = withSecurity(handler, SECURITY_PRESETS.PUBLIC);