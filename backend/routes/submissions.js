// backend/routes/submissions.js
const express = require('express');
const router = express.Router();
const supabase = require('../supabase/client');
const { requireAdmin } = require('../middleware/auth');

// ── POST /api/submissions ────────────────────────────────────────
// Public — anyone can submit a tool for review
router.post('/', async (req, res) => {
  try {
    const { name, url, category, pricing, description, submitter_email } = req.body;

    if (!name || !url) {
      return res.status(400).json({ error: 'name and url are required' });
    }

    // Basic URL validation
    try { new URL(url); } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const { data, error } = await supabase
      .from('submissions')
      .insert([{
        name,
        url,
        category: category || 'other',
        pricing: pricing || 'freemium',
        description,
        submitter_email: submitter_email || null,
        status: 'pending'
      }])
      .select('id, name, status')
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'Submission received! We review new tools every week.',
      id: data.id
    });
  } catch (err) {
    console.error('[POST /submissions]', err.message);
    res.status(500).json({ error: 'Failed to submit tool' });
  }
});

// ── GET /api/submissions ─────────────────────────────────────────
// Admin only — list all pending submissions
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ submissions: data, count: data.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// ── PATCH /api/submissions/:id ───────────────────────────────────
// Admin — approve (moves to tools table) or reject
router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const { action } = req.body; // 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be approve or reject' });
    }

    // Fetch submission
    const { data: sub, error: fetchErr } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !sub) return res.status(404).json({ error: 'Submission not found' });

    if (action === 'approve') {
      // Insert into tools table
      const { error: insertErr } = await supabase.from('tools').insert([{
        name: sub.name,
        icon: '🔧',
        category: sub.category,
        pricing: sub.pricing,
        description: sub.description,
        url: sub.url,
        tags: [],
        accent_color: '#7b5cf0',
        is_new: true,
        status: 'published'
      }]);
      if (insertErr) throw insertErr;
    }

    // Update submission status
    await supabase
      .from('submissions')
      .update({ status: action === 'approve' ? 'approved' : 'rejected' })
      .eq('id', req.params.id);

    res.json({ message: `Submission ${action}d successfully` });
  } catch (err) {
    console.error('[PATCH /submissions]', err.message);
    res.status(500).json({ error: 'Failed to update submission' });
  }
});

module.exports = router;
