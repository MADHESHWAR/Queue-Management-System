const dotenv = require('dotenv');
const path = require('path');

// Configure dotenv
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../server/config/db');
const Token = require('../server/models/Token');

const runTests = async () => {
  console.log('--- Starting QMS Backend Database Verification (MySQL) ---');
  
  try {
    await connectDB();
    console.log('✓ Connected to MySQL Database');
    
    // Clear any existing test data to start clean
    console.log('Cleaning active tokens table...');
    await Token.deleteAll();
    console.log('✓ Table cleared');
    
    // Test 1: Insert multiple mock customer tokens
    console.log('\nTest 1: Issuing new customer tokens...');
    const customers = ['Alice Smith', 'Bob Jones', 'Charlie Brown'];
    const tokens = [];
    
    for (let name of customers) {
      // Auto-increment logic replica
      const lastToken = await Token.findLast();
      const nextNum = lastToken ? lastToken.tokenNumber + 1 : 1;
      
      const t = await Token.create(nextNum, name);
      tokens.push(t);
      console.log(`  ✓ Generated Token #${t.tokenNumber} for ${t.customerName}`);
    }
    
    // Test 2: Calculate wait times
    console.log('\nTest 2: Verifying queue stats logic...');
    const allWaiting = await Token.countWaiting();
    console.log(`  Total waiting customers: ${allWaiting} (Expected: 3)`);
    if (allWaiting !== 3) throw new Error('Waiting count mismatch');
    
    const secondToken = tokens[1];
    const ahead = await Token.countWaitingAhead(secondToken.tokenNumber);
    console.log(`  Token #${secondToken.tokenNumber} (${secondToken.customerName}) position: ${ahead + 1} (Expected: 2)`);
    if (ahead + 1 !== 2) throw new Error('Queue position mismatch');
    
    // Test 3: Call Next Customer
    console.log('\nTest 3: Advancing queue ("Call Next")...');
    // Complete serving (none currently, but running update code)
    await Token.completeAllServing();
    
    // Get next waiting
    const nextToken = await Token.findFirstWaiting();
    if (!nextToken) throw new Error('No waiting token found when expected');
    
    const updatedNext = await Token.updateStatus(nextToken.id, 'Serving');
    console.log(`  ✓ Token #${updatedNext.tokenNumber} (${updatedNext.customerName}) is now ${updatedNext.status} (Expected: #1 Serving)`);
    if (updatedNext.tokenNumber !== 1 || updatedNext.status !== 'Serving') {
      throw new Error('Call Next failed to call first token');
    }
    
    // Test 4: Call Next again (should complete token #1 and serve token #2)
    console.log('\nTest 4: Calling Next again...');
    await Token.completeAllServing();
    const nextToken2 = await Token.findFirstWaiting();
    const updatedNext2 = await Token.updateStatus(nextToken2.id, 'Serving');
    console.log(`  ✓ Token #${updatedNext2.tokenNumber} (${updatedNext2.customerName}) is now ${updatedNext2.status} (Expected: #2 Serving)`);
    
    const completedToken1 = await Token.findById(tokens[0].id);
    console.log(`  ✓ Token #1 Status: ${completedToken1.status} (Expected: Completed)`);
    if (completedToken1.status !== 'Completed' || updatedNext2.tokenNumber !== 2 || updatedNext2.status !== 'Serving') {
      throw new Error('Call Next sequence failed');
    }
    
    // Test 5: Skip customer (Skip Token #3)
    console.log('\nTest 5: Skipping a customer...');
    const skipToken = await Token.updateStatus(tokens[2].id, 'Skipped');
    console.log(`  ✓ Token #3 Status: ${skipToken.status} (Expected: Skipped)`);
    if (skipToken.status !== 'Skipped') throw new Error('Skip status change failed');
    
    console.log('\n✓ All business logic database assertions PASSED!');
  } catch (err) {
    console.error('\n❌ Verification Failed:', err.message);
  } finally {
    // Close the connection pool if it was initialized
    try {
      const { getPool } = require('../server/config/db');
      const pool = getPool();
      await pool.end();
      console.log('\nDatabase connection closed. Exiting test.');
    } catch (e) {
      // Ignored if pool wasn't created
    }
  }
};

runTests();
