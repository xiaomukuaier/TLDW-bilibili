/**
 * Bilibili API Client
 *
 * Based on the SocialSisterYi/bilibili-API-collect project
 * This client handles Bilibili video metadata, transcripts, and other API calls
 */

import { VideoInfo } from './types';

export interface BilibiliVideoInfo {
  bvid: string;
  aid: number;
  title: string;
  desc: string;
  pic: string;
  duration: number;
  owner: {
    mid: number;
    name: string;
  };
  stat: {
    view: number;
    danmaku: number;
    reply: number;
    favorite: number;
    coin: number;
    share: number;
    like: number;
  };
  pages: Array<{
    cid: number;
    page: number;
    part: string;
    duration: number;
  }>;
}

export interface BilibiliSubtitle {
  id: number;
  lan: string;
  lan_doc: string;
  subtitle_url: string;
}

export interface BilibiliSubtitleData {
  body: Array<{
    from: number;
    to: number;
    content: string;
    location: number;
  }>;
}

/**
 * Extract Bilibili video ID from URL
 * Supports both BV and AV formats
 */
export function extractBilibiliVideoId(url: string): string | null {
  // Bilibili URL patterns
  const patterns = [
    // BV format: https://www.bilibili.com/video/BV1xx411c7mD
    /bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/i,
    // AV format: https://www.bilibili.com/video/av170001
    /bilibili\.com\/video\/av(\d+)/i,
    // Short URL: https://b23.tv/BV1xx411c7mD
    /b23\.tv\/(BV[a-zA-Z0-9]+)/i,
    // Mobile URL: https://m.bilibili.com/video/BV1xx411c7mD
    /m\.bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Get Bilibili video information
 * API: https://api.bilibili.com/x/web-interface/view
 */
export async function getBilibiliVideoInfo(videoId: string): Promise<BilibiliVideoInfo> {
  const isBv = videoId.startsWith('BV');
  const apiUrl = isBv
    ? `https://api.bilibili.com/x/web-interface/view?bvid=${videoId}`
    : `https://api.bilibili.com/x/web-interface/view?aid=${videoId}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Bilibili API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.code !== 0) {
      throw new Error(`Bilibili API error: ${result.message}`);
    }

    return result.data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Bilibili API请求超时，请检查网络连接');
    }
    throw new Error(`无法获取Bilibili视频信息: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * Get Bilibili video subtitles/transcripts
 * API: https://api.bilibili.com/x/player/v2
 */
export async function getBilibiliSubtitles(videoId: string, cid: number): Promise<BilibiliSubtitle[]> {
  const isBv = videoId.startsWith('BV');
  const apiUrl = isBv
    ? `https://api.bilibili.com/x/player/v2?bvid=${videoId}&cid=${cid}`
    : `https://api.bilibili.com/x/player/v2?aid=${videoId}&cid=${cid}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Bilibili subtitle API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.code !== 0) {
      throw new Error(`Bilibili subtitle API error: ${result.message}`);
    }

    return result.data.subtitle?.subtitles || [];
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Bilibili字幕API请求超时，请检查网络连接');
    }
    throw new Error(`无法获取Bilibili视频字幕: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * Fetch subtitle content from subtitle URL
 */
export async function fetchSubtitleContent(subtitleUrl: string): Promise<BilibiliSubtitleData> {
  // Bilibili subtitle URLs are relative, need to prepend with domain
  const fullUrl = subtitleUrl.startsWith('http')
    ? subtitleUrl
    : `https:${subtitleUrl}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(fullUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Subtitle fetch error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('字幕内容请求超时，请检查网络连接');
    }
    throw new Error(`无法获取字幕内容: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * Convert Bilibili video info to our VideoInfo format
 */
export function convertBilibiliToVideoInfo(
  bilibiliData: BilibiliVideoInfo,
  videoId: string
): VideoInfo {
  return {
    videoId,
    title: bilibiliData.title,
    author: bilibiliData.owner.name,
    thumbnail: bilibiliData.pic,
    duration: bilibiliData.duration,
    description: bilibiliData.desc,
    tags: [] // Bilibili doesn't provide tags in this API
  };
}

/**
 * Convert Bilibili subtitle data to transcript segments
 */
export function convertSubtitlesToTranscript(
  subtitleData: BilibiliSubtitleData
): Array<{ text: string; start: number; duration: number }> {
  return subtitleData.body.map((item, index) => {
    const start = item.from;
    const duration = item.to - item.from;

    return {
      text: item.content,
      start,
      duration
    };
  });
}

/**
 * Get preferred subtitle language (Chinese first, then others)
 */
export function getPreferredSubtitle(subtitles: BilibiliSubtitle[]): BilibiliSubtitle | null {
  // Prefer Chinese subtitles
  const chineseSubs = subtitles.filter(sub =>
    sub.lan === 'zh-CN' || sub.lan === 'zh-Hans' || sub.lan_doc.includes('中文')
  );

  if (chineseSubs.length > 0) {
    return chineseSubs[0];
  }

  // Fallback to any available subtitle
  return subtitles.length > 0 ? subtitles[0] : null;
}