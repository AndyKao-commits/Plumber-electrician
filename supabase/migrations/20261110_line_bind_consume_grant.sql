-- Ensure webhook (service_role) can execute consume_line_bind_code.
grant execute on function public.consume_line_bind_code(text, text) to service_role;

-- Also allow postgres role ownership path used by some projects
do $$
begin
  execute 'grant execute on function public.consume_line_bind_code(text, text) to supabase_admin';
exception when undefined_object then
  null;
end $$;
