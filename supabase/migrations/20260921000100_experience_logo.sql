-- A square mark beside each experience and education row: the organisation's logo, stored as a
-- public URL (typically a library publication). Additive; rows without one show their initial.
begin;

alter table public.experiences add column if not exists logo_url text
  check (logo_url is null or (logo_url ~ '^https?://' and length(logo_url) <= 2048));

commit;
