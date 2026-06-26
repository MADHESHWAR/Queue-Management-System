const Token = require('../models/Token');

// Issue a new token for a customer
const issueToken = async (req, res) => {
  try {
    const { customerName } = req.body;

    if (!customerName || customerName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Customer name is required'
      });
    }

    // Generate next token number (highest number + 1)
    const lastToken = await Token.findLast();
    const tokenNumber = lastToken ? lastToken.tokenNumber + 1 : 1;

    const newToken = await Token.create(tokenNumber, customerName.trim());

    // Calculate queue position for the new token
    const waitingAhead = await Token.countWaitingAhead(tokenNumber);

    return res.status(201).json({
      success: true,
      message: 'Token generated successfully',
      data: {
        id: newToken.id,
        _id: newToken._id,
        tokenNumber: newToken.tokenNumber,
        customerName: newToken.customerName,
        status: newToken.status,
        createdAt: newToken.createdAt,
        queuePosition: waitingAhead + 1,
        estimatedWaitTime: (waitingAhead + 1) * 10 // 10 minutes per person
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to generate token',
      error: error.message
    });
  }
};

// Get all tokens
const getTokens = async (req, res) => {
  try {
    const tokens = await Token.findAll();
    return res.status(200).json({
      success: true,
      data: tokens
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve tokens',
      error: error.message
    });
  }
};

// Get queue status details for a specific token
const getTokenDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const token = await Token.findById(id);

    if (!token) {
      return res.status(404).json({
        success: false,
        message: 'Token not found'
      });
    }

    let queuePosition = 0;
    let estimatedWaitTime = 0;

    if (token.status === 'Waiting') {
      const waitingAhead = await Token.countWaitingAhead(token.tokenNumber);
      queuePosition = waitingAhead + 1;
      estimatedWaitTime = queuePosition * 10;
    }

    const currentServing = await Token.findCurrentServing();

    return res.status(200).json({
      success: true,
      data: {
        token,
        queuePosition,
        estimatedWaitTime,
        currentServingTokenNumber: currentServing ? currentServing.tokenNumber : null
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve token details',
      error: error.message
    });
  }
};

// Get overall Queue statistics for Dashboard
const getQueueStats = async (req, res) => {
  try {
    const servingToken = await Token.findCurrentServing();
    const upcomingTokens = await Token.findUpcoming(5);

    const totalWaiting = await Token.countWaiting();
    const estimatedWaitTime = totalWaiting * 10; // Total waiting time for someone joining now

    return res.status(200).json({
      success: true,
      data: {
        servingToken: servingToken ? { tokenNumber: servingToken.tokenNumber, customerName: servingToken.customerName } : null,
        upcomingTokens: upcomingTokens.map(t => ({ tokenNumber: t.tokenNumber, customerName: t.customerName })),
        totalWaiting,
        estimatedWaitTime
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve queue statistics',
      error: error.message
    });
  }
};

// Call the next waiting customer (Admin Feature)
const callNext = async (req, res) => {
  try {
    // 1. Complete the current serving token (if any)
    await Token.completeAllServing();

    // 2. Find the next waiting customer (lowest token number)
    const nextToken = await Token.findFirstWaiting();

    if (!nextToken) {
      return res.status(200).json({
        success: true,
        message: 'No more customers in the waiting queue',
        data: null
      });
    }

    // 3. Mark as serving
    const updatedToken = await Token.updateStatus(nextToken.id, 'Serving');

    return res.status(200).json({
      success: true,
      message: `Token #${updatedToken.tokenNumber} (${updatedToken.customerName}) is now serving`,
      data: updatedToken
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to call next customer',
      error: error.message
    });
  }
};

// Manually update status of a token (Admin Feature)
const updateTokenStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Waiting', 'Serving', 'Completed', 'Skipped'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be Waiting, Serving, Completed, or Skipped.'
      });
    }

    const updatedToken = await Token.updateStatus(id, status);

    if (!updatedToken) {
      return res.status(404).json({
        success: false,
        message: 'Token not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Token #${updatedToken.tokenNumber} updated to ${status}`,
      data: updatedToken
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update token status',
      error: error.message
    });
  }
};

// Reset queue (Admin Feature)
const resetQueue = async (req, res) => {
  try {
    await Token.deleteAll();
    return res.status(200).json({
      success: true,
      message: 'Queue has been reset successfully. All tokens cleared.'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to reset queue',
      error: error.message
    });
  }
};

module.exports = {
  issueToken,
  getTokens,
  getTokenDetails,
  getQueueStats,
  callNext,
  updateTokenStatus,
  resetQueue
};
