-- New users start on the dark theme (matches the app's rebrand towards a
-- more "real trading platform" feel). Existing users keep whatever theme
-- they already have stored — this only changes the default applied when a
-- new profiles row is inserted without an explicit theme.
ALTER TABLE public.profiles ALTER COLUMN theme SET DEFAULT 'dark';
