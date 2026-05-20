// backend/routes/tools.js
const express = require('express');
const router = express.Router();
const supabase = require('../supabase/client');
const { requireAdmin } = require('../middleware/auth');

// ── GET /api/tools ──────────────────────────────────────────────
// Public. Supports ?category=writing&pricing=free&q=notion&limit=50
router.get('/', async (req, res) => {
  try {
    const { category, pricing, q, limit = 100 } = req.query;

    let query = supabase
      .from('tools')
      .select('*')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (category && category !== 'all') query = query.eq('category', category);
    if (pricing) query = query.eq('pricing', pricing);
    if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ tools: data, count: data.length });
  } catch (err) {
    console.error('[GET /tools]', err.message);
    res.status(500).json({ error: 'Failed to fetch tools' });
  }
});

// ── GET /api/tools/:id ──────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tools')
      .select('*')
      .eq('id', req.params.id)
      .eq('status', 'published')
      .single();

    if (error || !data) return res.status(404).json({ error: 'Tool not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tool' });
  }
});

// ── POST /api/tools ─────────────────────────────────────────────
// Admin only — create a new tool
router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      name, icon, category, pricing, description,
      url, affiliate_url, tags, accent_color, is_new, status
    } = req.body;

    if (!name || !category || !url) {
      return res.status(400).json({ error: 'name, category, and url are required' });
    }

    const { data, error } = await supabase
      .from('tools')
      .insert([{
        name,
        icon: icon || '🔧',
        category,
        pricing: pricing || 'freemium',
        description,
        url,
        affiliate_url: affiliate_url || null,
        tags: tags || [],
        accent_color: accent_color || '#7b5cf0',
        is_new: is_new ?? true,
        status: status || 'published'
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('[POST /tools]', err.message);
    res.status(500).json({ error: 'Failed to create tool' });
  }
});

// ── PATCH /api/tools/:id ────────────────────────────────────────
// Admin only — update any field
router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const allowed = [
      'name','icon','category','pricing','description',
      'url','affiliate_url','tags','accent_color','is_new','status'
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('tools')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[PATCH /tools]', err.message);
    res.status(500).json({ error: 'Failed to update tool' });
  }
});

// ── DELETE /api/tools/:id ───────────────────────────────────────
// Admin only — soft delete (sets status = 'archived')
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('tools')
      .update({ status: 'archived' })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Tool archived successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to archive tool' });
  }
});

module.exports = router;
