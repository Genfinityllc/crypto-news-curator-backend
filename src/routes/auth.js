const express = require('express');
const { getSupabaseClient } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Sign up with email and password
router.post('/signup', async (req, res) => {
  try {
    const { email, password, username, full_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Authentication service unavailable'
      });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username || email.split('@')[0],
          full_name: full_name || username || email.split('@')[0]
        }
      }
    });

    if (error) {
      logger.error('Signup error:', error.message);
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully. Please check your email to verify your account.',
      user: {
        id: data.user?.id,
        email: data.user?.email,
        username: data.user?.user_metadata?.username
      }
    });

  } catch (error) {
    logger.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Sign in with email and password
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Authentication service unavailable'
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      logger.error('Signin error:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    res.json({
      success: true,
      message: 'Signed in successfully',
      user: {
        id: data.user.id,
        email: data.user.email,
        username: data.user.user_metadata?.username
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    });

  } catch (error) {
    logger.error('Signin error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Sign out
router.post('/signout', authMiddleware, async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Authentication service unavailable'
      });
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.error('Signout error:', error.message);
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      message: 'Signed out successfully'
    });

  } catch (error) {
    logger.error('Signout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Authentication service unavailable'
      });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      logger.error('Profile fetch error:', error.message);
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    res.json({
      success: true,
      profile
    });

  } catch (error) {
    logger.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { username, full_name, preferences } = req.body;

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Authentication service unavailable'
      });
    }

    const updateData = {};
    if (username) updateData.username = username;
    if (full_name) updateData.full_name = full_name;
    if (preferences) updateData.preferences = preferences;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      logger.error('Profile update error:', error.message);
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      profile: data
    });

  } catch (error) {
    logger.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Bookmark an article
router.post('/bookmarks', authMiddleware, async (req, res) => {
  try {
    const { article_id } = req.body;

    if (!article_id) {
      return res.status(400).json({
        success: false,
        message: 'Article ID is required'
      });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Service unavailable'
      });
    }

    const { data, error } = await supabase
      .from('bookmarks')
      .insert([{
        user_id: req.user.id,
        article_id: article_id
      }])
      .select();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({
          success: false,
          message: 'Article already bookmarked'
        });
      }
      
      logger.error('Bookmark error:', error.message);
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(201).json({
      success: true,
      message: 'Article bookmarked successfully',
      bookmark: data[0]
    });

  } catch (error) {
    logger.error('Bookmark error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user bookmarks
router.get('/bookmarks', authMiddleware, async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Service unavailable'
      });
    }

    const { data, error } = await supabase
      .from('bookmarks')
      .select(`
        *,
        articles (
          id, title, url, source, published_at, category, network, is_breaking
        )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Bookmarks fetch error:', error.message);
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      bookmarks: data
    });

  } catch (error) {
    logger.error('Bookmarks error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Remove bookmark
router.delete('/bookmarks/:article_id', authMiddleware, async (req, res) => {
  try {
    const { article_id } = req.params;

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Service unavailable'
      });
    }

    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('user_id', req.user.id)
      .eq('article_id', article_id);

    if (error) {
      logger.error('Bookmark removal error:', error.message);
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      message: 'Bookmark removed successfully'
    });

  } catch (error) {
    logger.error('Bookmark removal error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ==========================================
// PASSWORD MANAGEMENT ENDPOINTS
// ==========================================

// Request password reset (sends email)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Service unavailable'
      });
    }

    // Send password reset email via Supabase
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL || 'https://your-frontend.com'}/reset-password`
    });

    if (error) {
      logger.error('Password reset request error:', error.message);
      // Don't reveal if email exists or not for security
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    logger.info(`Password reset requested for: ${email}`);
    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });

  } catch (error) {
    logger.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Reset password with token (from email link)
router.post('/reset-password', async (req, res) => {
  try {
    const { access_token, new_password } = req.body;

    if (!access_token || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'Access token and new password are required'
      });
    }

    if (new_password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Service unavailable'
      });
    }

    // Set the session with the access token from the email link
    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token: access_token // Supabase sends same token for recovery
    });

    if (sessionError) {
      logger.error('Session error during password reset:', sessionError.message);
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Update the password
    const { error } = await supabase.auth.updateUser({
      password: new_password
    });

    if (error) {
      logger.error('Password update error:', error.message);
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    logger.info('Password reset successful');
    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.'
    });

  } catch (error) {
    logger.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Change password (for logged-in users)
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (new_password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters'
      });
    }

    if (current_password === new_password) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: 'Service unavailable'
      });
    }

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: req.user.email,
      password: current_password
    });

    if (signInError) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update to new password
    const { error } = await supabase.auth.updateUser({
      password: new_password
    });

    if (error) {
      logger.error('Password change error:', error.message);
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    logger.info(`Password changed for user: ${req.user.id}`);
    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    logger.error('Password change error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;