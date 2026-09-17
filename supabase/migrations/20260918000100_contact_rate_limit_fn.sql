-- =============================================================
-- 聯絡表單速率限制：原子式 upsert contact_rate_limit
-- 由 contact form Server Action 以 service_role client 呼叫：
--   select contact_rate_limit_hit('<sha256(ip + salt)>', 5, interval '1 hour');
-- 回傳 true = 允許送出；false = 視窗內已超過 p_limit 次。
-- 視窗起點超過 p_window 時重新計數；同一 ip_hash 的並發呼叫由 row lock 序列化。
-- =============================================================
create or replace function contact_rate_limit_hit(p_ip_hash text, p_limit int, p_window interval)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_hits int;
begin
  if p_ip_hash is null or p_ip_hash = '' then
    return false;
  end if;

  insert into contact_rate_limit (ip_hash, hits, window_start)
  values (p_ip_hash, 1, now())
  on conflict (ip_hash) do update set
    hits = case
      when contact_rate_limit.window_start < now() - p_window then 1
      else contact_rate_limit.hits + 1
    end,
    window_start = case
      when contact_rate_limit.window_start < now() - p_window then now()
      else contact_rate_limit.window_start
    end
  returning hits into v_hits;

  return v_hits <= p_limit;
end $$;

revoke all on function contact_rate_limit_hit(text, int, interval) from public, anon, authenticated;
grant execute on function contact_rate_limit_hit(text, int, interval) to service_role;
