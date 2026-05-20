// backend/routes/collections.js
'use strict';
const express = require('express');
const router  = express.Router();
const supabase = require('../supabase/client');
const { requireAdmin } = require('../middleware/auth');

// GET /api/collections  — public
router.get('/', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('collections')
      .select('*, collection_tools(tool_id, sort_order, tools(*))')
      .eq('published', true)
      .order('sort_order');
    if (error) throw error;
    res.json({ collections: data });
  } catch (err) {
    console.error('[GET /collections]', err.message);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

// GET /api/collections/:slug  — public
router.get('/:slug', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('collections')
      .select('*, collection_tools(tool_id, sort_order, tools(*))')
      .eq('slug', req.params.slug)
      .eq('published', true)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Collection not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch collection' });
  }
});

// POST /api/collections  — admin
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { title, slug, description, emoji, tool_ids = [], sort_order = 0 } = req.body;
    if (!title || !slug) return res.status(400).json({ error: 'title and slug required' });

    const { data: col, error: colErr } = await supabase
      .from('collections')
      .insert([{ title, slug, description, emoji, sort_order, published: true }])
      .select().single();
    if (colErr) throw colErr;

    if (tool_ids.length) {
      await supabase.from('collection_tools').insert(
        tool_ids.map((id, i) => ({ collection_id: col.id, tool_id: id, sort_order: i }))
      );
    }
    res.status(201).json(col);
  } catch (err) {
    console.error('[POST /collections]', err.message);
    res.status(500).json({ error: 'Failed to create collection' });
  }
});

module.exports = router;
