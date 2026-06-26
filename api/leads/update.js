const { createClient } = require('@supabase/supabase-js');
const { verifyAdmin } = require('./_utils/auth');

module.exports = async (req, res) => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method !== 'PATCH' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { error: authError, status: authStatus } = await verifyAdmin(req);
  if (authError) return res.status(authStatus).json({ error: authError });

  const { id, status, confirmed_time, message } = req.body;

  if (!id) return res.status(400).json({ error: 'Lead ID required' });

  const updates = {};
  if (status) updates.status = status;
  if (confirmed_time) updates.confirmed_time = confirmed_time;
  if (message) updates.message = message;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ lead: data });
};
