// backend/middleware/auth.js
const { createClient } = require('@supabase/supabase-js');

// Separate anon-key client just for verifying user tokens
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * requireAuth — verifies the Bearer JWT from Supabase Auth.
 * Attaches req.user if valid.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = user;
  next();
}

/**
 * requireAdmin — after requireAuth, checks the user has admin role.
 * Role is stored in user_metadata.role (set via Supabase dashboard or admin script).
 */
async function requireAdmin(req, res, next) {
  await requireAuth(req, res, async () => {
    const role = req.user?.user_metadata?.role;
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
