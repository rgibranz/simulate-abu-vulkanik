// Mode render video: ?video=portrait|landscape → UI disembunyikan, layout kartu/strip untuk sosmed
export const VIDEO_VIEWS = {
  portrait: { width: 1080, height: 1920, center: [-6.7, 106.2], zoom: 8 }, // strip teks menutupi ~30 % bawah
  landscape: { width: 1920, height: 1080, center: [-6.3, 106.4], zoom: 8 },
}

export function useVideoMode(search = typeof window !== 'undefined' ? window.location.search : '') {
  const orientation = new URLSearchParams(search).get('video')
  const enabled = orientation === 'portrait' || orientation === 'landscape'
  return { enabled, orientation: enabled ? orientation : null, view: enabled ? VIDEO_VIEWS[orientation] : null }
}
