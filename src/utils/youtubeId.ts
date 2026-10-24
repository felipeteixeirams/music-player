const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function extractYouTubeId(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;

  const rawValue = value.trim();
  if (YOUTUBE_ID_PATTERN.test(rawValue)) return rawValue;

  try {
    const url = new URL(rawValue, 'https://www.youtube.com');
    const videoId = url.searchParams.get('v');
    if (videoId && YOUTUBE_ID_PATTERN.test(videoId)) return videoId;

    const segments = url.pathname.split('/').filter(Boolean);
    if (url.hostname === 'youtu.be') {
      return segments[0] && YOUTUBE_ID_PATTERN.test(segments[0]) ? segments[0] : null;
    }

    const idSegmentIndex = segments.findIndex((segment) =>
      ['embed', 'live', 'shorts', 'streams', 'v'].includes(segment)
    );
    const pathId = idSegmentIndex >= 0 ? segments[idSegmentIndex + 1] : null;
    return pathId && YOUTUBE_ID_PATTERN.test(pathId) ? pathId : null;
  } catch {
    return null;
  }
}