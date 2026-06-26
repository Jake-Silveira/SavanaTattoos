const { createClient } = require('@supabase/supabase-js');

/**
 * Verify admin authentication via Supabase JWT + admin_profiles check.
 */
async function verifyAdmin(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized', status: 401 };
  }

  const token = authHeader.substring(7);
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return { error: 'Invalid token', status: 401 };
    }

    const { data: profile, error: profileError } = await supabase
      .from('admin_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return { error: 'Admin access required', status: 403 };
    }

    return { user, profile, error: null, status: 200 };
  } catch (err) {
    return { error: 'Auth verification failed: ' + err.message, status: 500 };
  }
}

module.exports = { verifyAdmin };
