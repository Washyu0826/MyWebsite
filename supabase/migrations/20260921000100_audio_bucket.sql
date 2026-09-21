-- =============================================================
-- Storage bucket: audio
-- 背景音樂用。目前只有一首 CC0 的蕭邦夜曲（Musopen 錄音），
-- 兩種格式：Ogg Opus（主要）與 AAC/M4A（舊版 Safari 的退路）。
-- 公開讀取，寫入一律走 service_role。
-- =============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audio', 'audio', true, 8388608, array['audio/ogg','audio/mp4'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read audio bucket" on storage.objects;
create policy "public read audio bucket" on storage.objects
  for select to anon, authenticated using (bucket_id = 'audio');
