-- Event-trigger helper for auto-enabling RLS must not be callable via PostgREST.
-- Advisors: anon_security_definer_function_executable /
-- authenticated_security_definer_function_executable on public.rls_auto_enable().

revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
