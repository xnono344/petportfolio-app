-- Add notification_id to health_entries for cancelling scheduled
-- medication reminders when entries are edited or deleted.
alter table public.health_entries add column if not exists notification_id text;
