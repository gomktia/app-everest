import { logger } from '@/lib/logger'

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || ''
const CHANNEL_ID = import.meta.env.VITE_YOUTUBE_CHANNEL_ID || ''

export interface YouTubeVideo {
  id: string
  title: string
  thumbnail: string
  duration: number
  publishedAt: string
}

/** Parse ISO 8601 duration (PT1H2M3S) to seconds */
function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const h = parseInt(match[1] || '0')
  const m = parseInt(match[2] || '0')
  const s = parseInt(match[3] || '0')
  return h * 3600 + m * 60 + s
}

export async function getYouTubeVideos(params?: {
  search?: string
  pageToken?: string
}): Promise<{ videos: YouTubeVideo[]; nextPageToken?: string }> {
  try {
    if (!YOUTUBE_API_KEY || !CHANNEL_ID) {
      logger.warn('YouTube API key or Channel ID not configured')
      return { videos: [] }
    }

    // Step 1: Search for videos
    const searchParams = new URLSearchParams({
      key: YOUTUBE_API_KEY,
      channelId: CHANNEL_ID,
      part: 'snippet',
      type: 'video',
      maxResults: '24',
      order: 'date',
    })
    if (params?.search) searchParams.set('q', params.search)
    if (params?.pageToken) searchParams.set('pageToken', params.pageToken)

    const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams}`)
    if (!searchRes.ok) throw new Error(`YouTube API error: ${searchRes.status}`)
    const searchData = await searchRes.json()

    const videoIds = (searchData.items || []).map((item: any) => item.id.videoId).filter(Boolean)
    if (videoIds.length === 0) return { videos: [] }

    // Step 2: Get video details (duration)
    const detailParams = new URLSearchParams({
      key: YOUTUBE_API_KEY,
      id: videoIds.join(','),
      part: 'contentDetails,snippet',
    })

    const detailRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?${detailParams}`)
    if (!detailRes.ok) throw new Error(`YouTube API error: ${detailRes.status}`)
    const detailData = await detailRes.json()

    const videos: YouTubeVideo[] = (detailData.items || []).map((item: any) => ({
      id: item.id,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
      duration: parseDuration(item.contentDetails?.duration || ''),
      publishedAt: item.snippet.publishedAt,
    }))

    return {
      videos,
      nextPageToken: searchData.nextPageToken,
    }
  } catch (error) {
    logger.error('Error fetching YouTube videos:', error)
    return { videos: [] }
  }
}

/** Extract video ID from a YouTube URL */
export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}
