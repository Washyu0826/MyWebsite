// What the background music actually is, kept apart from the graph that plays it so the footer can
// credit the recording without pulling Web Audio into a server component.
//
// The licensing distinction this file exists to record: a Chopin nocturne written in 1843 is long out
// of copyright, but a *recording* of it is a separate work with its own rights, and most "free
// classical music" downloads are only free in the first sense. This one is from Musopen's Chopin set,
// which the performer and Musopen released under CC0 1.0 - a public-domain dedication covering the
// performance itself. Item metadata at archive.org/metadata/musopen-chopin carries
// licenseurl = creativecommons.org/publicdomain/zero/1.0/, uploaded by aaron@musopen.org.
//
// CC0 asks for no attribution. The footer credits it anyway, because saying where a thing came from
// is the point of the line, not a licence condition.

export const TRACK = {
  title: 'Nocturne in F minor, Op. 55 No. 1',
  titleZh: 'F 小調夜曲，作品 55 之 1',
  composer: 'Frédéric Chopin',
  composerZh: '蕭邦',
  source: 'Musopen',
  sourceUrl: 'https://archive.org/details/musopen-chopin',
  licence: 'CC0 1.0',
  licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  /** The encode, after trimming: one pass of the piece plus about two seconds of silence to loop over. */
  seconds: 311.8,
  /** Both measured on the encoded files with ffmpeg's ebur128. MUSIC_GAIN is derived from the peak. */
  peakDbfs: -5.4,
  loudnessLufs: -19,
} as const;

const BUCKET = 'audio', STEM = 'chopin-nocturne-op55-no1';
/** Ogg Opus first (Safari has carried it since 17.5), AAC behind it for anything older. */
export const FORMATS = [
  { file: `${STEM}.opus`, type: 'audio/ogg; codecs=opus' },
  { file: `${STEM}.m4a`, type: 'audio/mp4; codecs="mp4a.40.2"' },
] as const;
export type Format = (typeof FORMATS)[number];

/** Built from the public Supabase URL, so the bucket follows the project rather than being pasted in.
 *  Null when the site runs without Supabase configured: the chimes still work, the music does not. */
export function trackUrl(file: string, origin = process.env.NEXT_PUBLIC_SUPABASE_URL): string | null {
  if (!origin) return null;
  return `${origin.replace(/\/+$/, '')}/storage/v1/object/public/${BUCKET}/${file}`;
}

/** The first format this browser admits to playing. `canPlayType` answers '', 'maybe' or 'probably'. */
export function pickFormat(canPlay: (type: string) => string): Format | null {
  return FORMATS.find(format => canPlay(format.type) !== '') ?? null;
}
