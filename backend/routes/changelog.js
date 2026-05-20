// backend/routes/changelog.js
const express = require('express');
const router = express.Router();
const supabase = require('../supabase/client');
const { requireAdmin } = require('../middleware/auth');

// ── GET /api/changelog ───────────────────────────────────────────
// Public — returns latest changelog entries
router.get('/', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const { data, error } = await supabase
      .from('changelog')
      .select('*')
      .order('week_of', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;
    res.json({ entries: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch changelog' });
  }
});

// ── POST /api/changelog ──────────────────────────────────────────
// Admin — publish a new weekly update
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { week_of, title, summary, added = [], updated = [], removed = [] } = req.body;

    if (!week_of || !title) {
      return res.status(400).json({ error: 'week_of and title are required' });
    }

    const { data, error } = await supabase
      .from('changelog')
      .insert([{ week_of, title, summary, added, updated, removed }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('[POST /changelog]', err.message);
    res.status(500).json({ error: 'Failed to create changelog entry' });
  }
});

// ── PATCH /api/changelog/:id ─────────────────────────────────────
router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const { week_of, title, summary, added, updated, removed } = req.body;
    const updates = {};
    if (week_of !== undefined) updates.week_of = week_of;
    if (title !== undefined) updates.title = title;
    if (summary !== undefined) updates.summary = summary;
    if (added !== undefined) updates.added = added;
    if (updated !== undefined) updates.updated = updated;
    if (removed !== undefined) updates.removed = removed;

    const { data, error } = await supabase
      .from('changelog')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update changelog entry' });
  }
});

// ── DELETE /api/changelog/:id ────────────────────────────────────
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('changelog')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Changelog entry deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete changelog entry' });
  }
});

module.exports = router;
