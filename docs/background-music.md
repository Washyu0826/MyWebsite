# Background music

The sound toggle in the bottom-right corner plays one piece of classical piano, quietly, on a loop.
This file records what it is, why it is legally safe to publish, how the file was made, and how to
replace it.

## What is playing

Chopin's Nocturne in F minor, Op. 55 No. 1, from **Musopen's Complete Chopin Collection**.

| | |
|---|---|
| Source | <https://archive.org/details/musopen-chopin> |
| Licence | CC0 1.0 Universal (public domain dedication) |
| Uploaded by | `aaron@musopen.org` (Musopen's founder) |
| Duration served | 311.8 s, looped whole |

## The licensing point, because it is the easy thing to get wrong

A Chopin nocturne written in 1843 is long out of copyright. **A recording of it is a separate work
with its own rights**, usually held by the performer and the label, and it typically runs for decades
from the date of the recording rather than the death of the composer.

Most files on the internet labelled "free classical music" are free only in the first sense: the
composition is public domain, the performance is not. Putting one of those on a personal site is how
people receive letters from lawyers.

Musopen's Chopin set is one of the few where the recording itself carries a public-domain dedication.
It can be confirmed without trusting any description text:

```bash
curl -s https://archive.org/metadata/musopen-chopin | python -c "import json,sys; print(json.load(sys.stdin)['metadata']['licenseurl'])"
# http://creativecommons.org/publicdomain/zero/1.0/
```

CC0 requires no attribution. The footer credits the recording anyway, because saying where something
came from is worth one line.

## How the file was made

The raw take is 24-bit ALAC, integrated **−25.2 LUFS** with a loudness range of **12.4 LU**. That
range is the problem for background use, not the level: the climax would be roughly three times as
loud as the opening, so any gain quiet enough for the opening makes the climax jump out.

Source: `Nocturne Op. 55 no. 1 in F minor.m4a` from the archive.org item above. It was chosen by
measuring the loudness range of six candidate nocturnes and preludes with `ebur128` and taking the
narrowest.

```bash
# 1. trim to 1.8s-313.6s, which leaves ~0.8s of silence before the first note and ~1.2s after the
#    last, so the loop has about two seconds of breath between passes
# 2. highpass, then a slow compressor to bring 12.4 LU down to 6 LU
# 3. two-pass loudnorm to -19 LUFS integrated, linear so nothing pumps
FILT="highpass=f=28,acompressor=threshold=0.03:ratio=4:attack=50:release=600:knee=8:makeup=2"

ffmpeg -ss 1.8 -to 313.6 -i src.m4a -af "$FILT,loudnorm=I=-19:TP=-2:LRA=7:print_format=json" -f null -
# then feed the measured_* values back in:
ffmpeg -y -ss 1.8 -to 313.6 -i src.m4a \
  -af "$FILT,loudnorm=I=-19:TP=-2:LRA=7:measured_I=-24.95:measured_TP=-11.53:measured_LRA=6.00:measured_thresh=-35.03:offset=-1.18:linear=true,aresample=48000:resampler=soxr:precision=28,afade=t=in:st=0:d=0.04,afade=t=out:st=311.76:d=0.04" \
  -ar 48000 -c:a pcm_s24le master.wav

ffmpeg -y -i master.wav -c:a libopus -b:a 64k -vbr on -compression_level 10 \
  -application audio -frame_duration 60 chopin-nocturne-op55-no1.opus   # 2.50 MB
ffmpeg -y -i master.wav -c:a aac -b:a 80k -movflags +faststart \
  chopin-nocturne-op55-no1.m4a                                          # 3.19 MB
```

Both encodes decode back to **−19.0 LUFS, 6.0 LU, peak −5.4 dBFS**, which is what `TRACK` in
`src/lib/audio/track.ts` records and what the test measures.

AAC is there only for Safari older than 17.5, which cannot play Ogg Opus. One file or the other is
downloaded, never both.

## Where it lives

A public `audio` bucket in Supabase Storage, created by
`supabase/migrations/20260921000100_audio_bucket.sql`. Writes go through `service_role` only; reads
are open to `anon`. Upload with a long `cacheControl`, or every visit re-downloads two and a half
megabytes:

```bash
curl -X PUT "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/audio/chopin-nocturne-op55-no1.opus" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -F "cacheControl=31536000" -F "file=@chopin-nocturne-op55-no1.opus;type=audio/ogg"
```

The URL is built from `NEXT_PUBLIC_SUPABASE_URL` at build time, so the bucket follows the project and
no host is written into the source. With Supabase unconfigured the music is simply absent and the two
confirmation chimes still work.

Supabase serves `Access-Control-Allow-Origin: *` and honours range requests, which is what lets the
element stream and lets a `GainNode` read it. The service worker does not touch it: `bypass()` in
`public/sw.js` returns early for every cross-origin request.

## How loud it actually is

`MUSIC_GAIN` is `0.1`, exactly −20 dB. Against a file peaking at −5.4 dBFS that puts the loudest
moment of the piece at about **−25 dBFS** at the page's output, which is the level the previous
generative piece ran at.

`outputPeakDbfs()` is the single expression for this, and `tests/audio.test.ts` asserts it stays at or
below −25 dBFS. Raising the gain without meaning to fails the suite.

## Nothing happens until the toggle is pressed

- No `AudioContext` is constructed and no `Audio` element exists at module scope. Both are built
  inside `createAmbient()`, first reached from `start()`, which only the toggle calls.
- `preload="none"`, and the `src` is set in the same helper, so the network sees nothing until
  `play()`.
- Tabbing away fades out over 0.35 s and then pauses the element and suspends the context. Coming back
  resumes from where it stopped.
- `dispose()` pauses, clears `src` and calls `load()`, which is what stops a paused element from
  finishing its download in the background.

On a platform with no usable `MediaElementAudioSourceNode` the element's own `volume` is the only
control, and iOS ignores writes to it. The graph writes `MUSIC_GAIN`, reads it back, and gives up on
the music if the value did not take — playing at the file's own level would be twenty decibels over
the brief.

## Replacing the piece

1. Find a recording whose **recording** is CC0 or public domain, and verify it from item metadata
   rather than page copy.
2. Measure it. `ffmpeg -i in.mp3 -af ebur128=peak=true -f null -` gives integrated loudness, loudness
   range and true peak. Anything above about 8 LU of range will not sit under a page.
3. Run the chain above, adjusting the trim points and the `measured_*` values.
4. Upload both encodes under new names and update `STEM` in `src/lib/audio/track.ts`.
5. Update `TRACK` — title, composer, source, licence, duration, and the two measured numbers.
6. Update `Site.audioCredit` in `messages/zh.json` and `messages/en.json`. The `<src>` and `<lic>`
   tags are filled in by `src/components/footer.tsx` from `TRACK`.
7. Verify against the published files:

   ```bash
   AUDIO_VERIFY=1 npm test
   ```

   That test is skipped by default. It downloads the track and shells out to `ffmpeg`, which is too
   slow for a pre-commit run, but it is the only check that what is actually published matches what
   `TRACK` claims.
