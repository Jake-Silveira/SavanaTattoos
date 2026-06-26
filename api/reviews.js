const { createClient } = require('@supabase/supabase-js');
const { verifyAdmin } = require('./_utils/auth');

module.exports = async (req, res) => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ reviews: data });
  }

  if (req.method === 'POST') {
    const { error: authError, status: authStatus } = await verifyAdmin(req);
    if (authError) return res.status(authStatus).json({ error: authError });

    const { reviewer_name, review_text, rating, display_order } = req.body;
    if (!review_text) return res.status(400).json({ error: 'Review text required' });

    const { data: maxItems } = await supabase
      .from('reviews')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1);
    const nextOrder = (maxItems && maxItems[0] && maxItems[0].display_order) ? maxItems[0].display_order + 1 : 1;

    const { data, error } = await supabase
      .from('reviews')
      .insert([{
        reviewer_name: reviewer_name || 'Anonymous', review_text,
        rating: parseInt(rating) || 5, display_order: display_order || nextOrder, is_active: true
      }])
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ review: data });
  }

  if (req.method === 'DELETE') {
    const { error: authError, status: authStatus } = await verifyAdmin(req);
    if (authError) return res.status(authStatus).json({ error: authError });
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Review ID required' });
    await supabase.from('reviews').delete().eq('id', id);
    return res.status(200).json({ success: true });
  }

  if (req.method === 'PATCH') {
    const { error: authError, status: authStatus } = await verifyAdmin(req);
    if (authError) return res.status(authStatus).json({ error: authError });
    const { id, reviewer_name, review_text, rating, display_order, is_active } = req.body;
    const updates = {};
    if (reviewer_name !== undefined) updates.reviewer_name = reviewer_name;
    if (review_text !== undefined) updates.review_text = review_text;
    if (rating !== undefined) updates.rating = parseInt(rating);
    if (display_order !== undefined) updates.display_order = display_order;
    if (is_active !== undefined) updates.is_active = is_active;
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('reviews')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ review: data });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
