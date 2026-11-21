// Vul dit in zodra het nieuwe (3e, aparte) Supabase-project is aangemaakt:
// Project Settings -> API -> Project URL en anon public key.
const SUPABASE_URL = 'VUL_HIER_DE_PROJECT_URL_IN';
const SUPABASE_ANON_KEY = 'VUL_HIER_DE_ANON_KEY_IN';

let _sb = null;
function getSupabase() {
  if (!_sb) _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _sb;
}
