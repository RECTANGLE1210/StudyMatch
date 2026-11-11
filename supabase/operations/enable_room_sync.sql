-- Run only after 202611110002_room_sync_rollout.sql and compatible frontend are deployed.
-- Repeating while enabled preserves the original cutoff and all existing rooms.
update public.room_sync_rollout
set enabled=true, starts_at=clock_timestamp()
where singleton and not enabled;
select enabled,starts_at from public.room_sync_rollout where singleton;
