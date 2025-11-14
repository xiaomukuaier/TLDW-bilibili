import { NextRequest, NextResponse } from 'next/server';
import { extractVideoId, detectPlatform } from '@/lib/utils';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';
import { getBilibiliVideoInfo, convertBilibiliToVideoInfo } from '@/lib/bilibili-client';

async function handler(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: '视频URL是必需的' },
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

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: `无效的${platform === 'youtube' ? 'YouTube' : 'Bilibili'} URL` },
        { status: 400 }
      );
    }

    // Handle different platforms
    if (platform === 'bilibili') {
      try {
        const bilibiliData = await getBilibiliVideoInfo(videoId);
        const videoInfo = convertBilibiliToVideoInfo(bilibiliData, videoId);

        return NextResponse.json({
          ...videoInfo,
          platform: 'bilibili'
        });
      } catch (bilibiliError) {
        console.error('[VIDEO-INFO] Bilibili API error:', {
          error: bilibiliError,
          message: (bilibiliError as Error).message,
          stack: (bilibiliError as Error).stack
        });

        // Return minimal Bilibili info on error
        return NextResponse.json({
          videoId,
          title: 'Bilibili视频',
          author: '未知',
          thumbnail: '',
          duration: null,
          platform: 'bilibili'
        });
      }
    } else {
      // YouTube platform
      // Try Supadata API first for richer metadata including description
      const apiKey = process.env.SUPADATA_API_KEY;

      if (apiKey) {
        try {
          const supadataUrl = `https://api.supadata.ai/v1/youtube/video?id=${videoId}`;

          const supadataResponse = await fetch(supadataUrl, {
            method: 'GET',
            headers: {
              'x-api-key': apiKey,
              'Content-Type': 'application/json'
            }
          });

          if (supadataResponse.ok) {
            const supadataData = await supadataResponse.json();

            // Extract video metadata from Supadata response
            return NextResponse.json({
              videoId,
              title: supadataData.title || 'YouTube Video',
              author: supadataData.channel?.name || supadataData.author || 'Unknown',
              thumbnail: supadataData.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
              duration: supadataData.duration || null,
              description: supadataData.description || undefined,
              tags: supadataData.tags || supadataData.keywords || undefined,
              platform: 'youtube'
            });
          }
        } catch (supadataError) {
          // Fall through to oEmbed if Supadata fails
          console.error('[VIDEO-INFO] Supadata API error:', {
            error: supadataError,
            message: (supadataError as Error).message,
            stack: (supadataError as Error).stack
          });
        }
      }

      // Fallback to YouTube oEmbed API (no API key required)
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;

      try {
        const response = await fetch(oembedUrl);

        if (!response.ok) {
          // Return minimal info if oEmbed fails
          return NextResponse.json({
            videoId,
            title: 'YouTube Video',
            author: 'Unknown',
            thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            duration: null,
            platform: 'youtube'
          });
        }

        const data = await response.json();

        return NextResponse.json({
          videoId,
          title: data.title || 'YouTube Video',
          author: data.author_name || 'Unknown',
          thumbnail: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          duration: null, // oEmbed doesn't provide duration or description
          platform: 'youtube'
        });

      } catch (fetchError) {
        // Return minimal info on error
        return NextResponse.json({
          videoId,
          title: 'YouTube Video',
          author: 'Unknown',
          thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          duration: null,
          platform: 'youtube'
        });
      }
    }
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch video information' },
      { status: 500 }
    );
  }
}

export const POST = withSecurity(handler, SECURITY_PRESETS.PUBLIC);