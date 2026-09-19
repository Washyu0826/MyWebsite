-- Intrinsic size + blur placeholder for images uploaded through the admin, keyed by the public URL
-- that content rows already store (projects.cover_url, project_media.url, posts.cover_url, ...).
-- Additive and optional: rows are missing for every image uploaded before this migration, and the
-- reader (src/lib/images.ts) treats a missing row as "no blur, no known size".
begin;

create table if not exists public.image_metadata (
  public_url text primary key check (public_url ~ '^https?://' and length(public_url) <= 2048),
  bucket text not null check (bucket in ('media', 'resume')),
  object_path text not null,
  width integer not null check (width between 1 and 65535),
  height integer not null check (height between 1 and 65535),
  -- Rendered by sharp at 12px wide; the pattern keeps an arbitrary URL out of next/image's blurDataURL.
  blur_data_url text check (blur_data_url ~ '^data:image/(webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$' and length(blur_data_url) <= 4096),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/gif')),
  byte_size bigint check (byte_size between 1 and 8388608),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists image_metadata_object_idx on public.image_metadata(bucket, object_path);

alter table public.image_metadata enable row level security;

-- Dimensions of already-public images are not a secret: the public site reads them with the anon key.
drop policy if exists "image_metadata public read" on public.image_metadata;
create policy "image_metadata public read" on public.image_metadata for select to anon, authenticated using (true);

revoke all on public.image_metadata from anon, authenticated;
grant select on public.image_metadata to anon, authenticated;
grant all on public.image_metadata to service_role;

commit;
