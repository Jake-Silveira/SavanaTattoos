const { createClient } = require('@supabase/supabase-js');
const { verifyAdmin } = require('./_utils/auth');

module.exports = async (req, res) => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { error: authError, status: authStatus } = await verifyAdmin(req);
  if (authError) return res.status(authStatus).json({ error: authError });

  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Lead ID required' });

  // Soft-delete: set status to 'deleted' instead of actually deleting
  const { error } = await supabase
    .from('leads')
    .update({ status: 'deleted', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
};
