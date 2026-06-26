const express = require('express');
const router = express.Router();
const { protect } = require('../controllers/authController');
const {
  issueToken,
  getTokens,
  getTokenDetails,
  getQueueStats,
  callNext,
  updateTokenStatus,
  resetQueue
} = require('../controllers/tokenController');

// Public endpoints
router.post('/', issueToken);
router.get('/', getTokens);
router.get('/stats', getQueueStats);
router.get('/:id', getTokenDetails);

// Admin-only endpoints (Protected by JWT)
router.post('/admin/call-next', protect, callNext);
router.put('/admin/:id/status', protect, updateTokenStatus);
router.delete('/admin/reset', protect, resetQueue);

module.exports = router;
