const { createClient } = require('@supabase/supabase-js');
const { verifyAdmin } = require('./_utils/auth');

module.exports = async (req, res) => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'POST') {
    const { error: authError, status: authStatus } = await verifyAdmin(req);
    if (authError) return res.status(authStatus).json({ error: authError });
    const { date, is_full_day, start_time, end_time, note } = req.body;
    if (!date) return res.status(400).json({ error: 'Date required' });
    const { data, error } = await supabase
      .from('blocked_slots')
      .insert([{ date, is_full_day: is_full_day || false, start_time: start_time || null, end_time: end_time || null, note: note || null }])
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ slot: data });
  }

  if (req.method === 'DELETE') {
    const { error: authError, status: authStatus } = await verifyAdmin(req);
    if (authError) return res.status(authStatus).json({ error: authError });
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Block ID required' });
    await supabase.from('blocked_slots').delete().eq('id', id);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
