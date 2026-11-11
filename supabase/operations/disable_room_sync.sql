-- Stop enrollment of new rooms. Already-active shared timers continue unchanged.
update public.room_sync_rollout set enabled=false where singleton;
select enabled,starts_at from public.room_sync_rollout where singleton;
