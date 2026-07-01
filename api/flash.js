const { createClient } = require('@supabase/supabase-js');
const { verifyAdmin } = require('./_utils/auth');

function isValidImageUrl(url) {
    if (!url || typeof url !== 'string' || !url.trim()) return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

module.exports = async (req, res) => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('flash_gallery')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ items: data });
  }

  if (req.method === 'POST') {
    const { error: authError, status: authStatus } = await verifyAdmin(req);
    if (authError) return res.status(authStatus).json({ error: authError });

    const { image_url, title, price, description, display_order } = req.body;
    if (!image_url) return res.status(400).json({ error: 'Image URL required' });
    if (!isValidImageUrl(image_url)) return res.status(400).json({ error: 'Invalid image URL format' });

    const { data: maxItems } = await supabase
      .from('flash_gallery')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1);
    const nextOrder = (maxItems && maxItems[0] && maxItems[0].display_order) ? maxItems[0].display_order + 1 : 1;

    const { data, error } = await supabase
      .from('flash_gallery')
      .insert([{
        image_url, title: title || 'Flash Design', price: price || null,
        description: description || null, display_order: display_order || nextOrder, is_active: true
      }])
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ item: data });
  }

  if (req.method === 'DELETE') {
    const { error: authError, status: authStatus } = await verifyAdmin(req);
    if (authError) return res.status(authStatus).json({ error: authError });
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Item ID required' });
    await supabase.from('flash_gallery').delete().eq('id', id);
    return res.status(200).json({ success: true });
  }

  if (req.method === 'PATCH') {
    const { error: authError, status: authStatus } = await verifyAdmin(req);
    if (authError) return res.status(authStatus).json({ error: authError });
    const { id, image_url, title, price, description, display_order, is_active } = req.body;
    const updates = {};
    if (image_url) {
        if (!isValidImageUrl(image_url)) return res.status(400).json({ error: 'Invalid image URL format' });
        updates.image_url = image_url;
    }
    if (title !== undefined) updates.title = title;
    if (price !== undefined) updates.price = price;
    if (description !== undefined) updates.description = description;
    if (display_order !== undefined) updates.display_order = display_order;
    if (is_active !== undefined) updates.is_active = is_active;
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('flash_gallery')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ item: data });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
