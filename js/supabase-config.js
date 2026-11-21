// Project Settings -> API: Project URL en publishable key.
const SUPABASE_URL = 'https://rzgslvnncrvcshgacrow.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lR6rV_XjJcq-fC77KPKw0A_dNQ8JsyU';

let _sb = null;
function getSupabase() {
  if (!_sb) _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _sb;
}
