# Privacy Integration Tests

This directory contains end-to-end integration tests for the Sipher Privacy Integration.

## Test Files

### 1. `shielded-transfer-e2e.test.ts`
**Phase 1: Shielded ARU Transfers**

Tests the complete shielded transfer workflow:
- Generate recipient meta-address
- Build shielded transfer transaction
- Submit transfer to blockchain
- Scan for incoming payments
- Claim payments to real wallet
- Verify balance changes
- Handle concurrent transfers

**Requirements**: 1.1, 2.1, 3.1, 4.1

### 2. `mev-protected-rebalancing-e2e.test.ts`
**Phase 2: MEV-Protected Rebalancing**

Tests the MEV protection workflow:
- Analyze vault privacy score
- Create Pedersen commitments
- Generate stealth destination addresses
- Execute protected swaps
- Verify homomorphic commitment operations
- Track privacy score trends
- Identify low privacy vaults

**Requirements**: 6.1, 7.1, 9.1, 10.1

### 3. `compliance-workflow-e2e.test.ts` ✨ NEW
**Phase 3: Compliance Layer**

Tests the complete compliance workflow:
- Setup hierarchical viewing key structure (m/0 → m/0/org → m/0/org/2026 → m/0/org/2026/Q1)
- Disclose transactions to auditors with role-based access
- Verify viewing key hierarchy relationships
- Decrypt disclosed data with viewing keys
- Generate compliance reports
- Enforce expiration on disclosures
- Track disclosure events for audit trail
- Revoke disclosures
- Rotate viewing keys
- Verify database consistency
- Enforce hierarchical access levels
- Prevent access to higher privilege levels

**Requirements**: 12.1, 13.1, 14.1, 15.1, 16.1, 17.1

### 4. `all-phases-integration.test.ts` ✨ NEW
**All Phases Integration (Task 18.1)**

Tests that all three phases work together seamlessly:
- End-to-end workflow: shielded transfer → MEV protection → compliance disclosure
- MEV-protected vault rebalancing with compliance reporting
- Cross-phase data consistency verification
- Payment scanning → commitment verification → disclosure workflow
- Concurrent operations across all phases
- Database integrity and foreign key relationships
- Privacy score tracking throughout workflows
- Homomorphic commitment operations in context
- Role-based disclosure for different transaction types

**Requirements**: All phases (1.1-17.1)

## Running Tests

### Run All Privacy Tests
```bash
npm run test -- src/services/privacy/tests --run
```

### Run Specific Test Suite
```bash
# Shielded transfers
npm run test -- src/services/privacy/tests/shielded-transfer-e2e.test.ts --run

# MEV protection
npm run test -- src/services/privacy/tests/mev-protected-rebalancing-e2e.test.ts --run

# Compliance workflow
npm run test -- src/services/privacy/tests/compliance-workflow-e2e.test.ts --run

# All phases integration
npm run test -- src/services/privacy/tests/all-phases-integration.test.ts --run
```

### Run with Coverage
```bash
npm run test -- src/services/privacy/tests --coverage --run
```

## Prerequisites

### Database
All E2E tests require a running Supabase instance:

```bash
# Start Supabase with Docker
docker-compose up -d

# Or use local Supabase
supabase start
```

### Environment Variables
Create a `.env` file in the `backend` directory:

```bash
# Supabase
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_KEY=your-service-key

# Sipher API (optional for most tests)
SIPHER_API_URL=https://sipher.sip-protocol.org
SIPHER_API_KEY=your-api-key

# Protocol Keys
PROTOCOL_MASTER_KEY=your-protocol-master-key
```

## Test Behavior

### Graceful Skipping
All tests gracefully skip when:
- Supabase is not available
- Sipher API key is not configured (where required)
- Required services are not running

Tests will log warnings explaining why they were skipped and how to enable them.

### Test Isolation
Each test suite:
- Creates its own test data in `beforeAll`
- Cleans up all test data in `afterAll`
- Uses unique identifiers to avoid conflicts
- Does not interfere with other tests

### Timeouts
- Standard tests: 30 seconds
- E2E workflow tests: 60-120 seconds (to account for API calls and database operations)

## Test Coverage

### Phase 1: Shielded Transfers
- ✅ Meta-address generation
- ✅ Stealth address derivation
- ✅ Shielded transfer building
- ✅ Transaction submission
- ✅ Payment scanning
- ✅ Payment claiming
- ✅ Concurrent operations

### Phase 2: MEV Protection
- ✅ Privacy score analysis
- ✅ Pedersen commitment creation
- ✅ Commitment verification
- ✅ Homomorphic addition
- ✅ Stealth destination generation
- ✅ Protected swap workflow
- ✅ Privacy score tracking
- ✅ Batch operations

### Phase 3: Compliance
- ✅ Hierarchical viewing key setup
- ✅ Viewing key derivation (BIP32-style)
- ✅ Hierarchy verification
- ✅ Role-based disclosure (internal/external/regulator)
- ✅ Transaction encryption/decryption
- ✅ Compliance verification
- ✅ AML/CFT checks
- ✅ Compliance report generation
- ✅ Disclosure expiration enforcement
- ✅ Disclosure revocation
- ✅ Viewing key rotation
- ✅ Audit trail logging
- ✅ Privilege level enforcement

### All Phases Integration (Task 18.1)
- ✅ End-to-end cross-phase workflow
- ✅ Shielded transfer → MEV protection → compliance disclosure
- ✅ MEV-protected rebalancing with compliance reporting
- ✅ Cross-phase data consistency
- ✅ Database foreign key relationships
- ✅ Payment scanning → commitment → disclosure workflow
- ✅ Concurrent operations across phases
- ✅ Data integrity verification
- ✅ Privacy score tracking throughout workflows
- ✅ Homomorphic operations in context

## Debugging

### Enable Verbose Logging
Set environment variable:
```bash
DEBUG=sipher:*
```

### View Test Output
```bash
npm run test -- src/services/privacy/tests --run --reporter=verbose
```

### Inspect Database State
After a test failure, you can inspect the database:
```bash
# Connect to Supabase
psql postgresql://postgres:postgres@localhost:54322/postgres

# View test data
SELECT * FROM viewing_keys;
SELECT * FROM disclosures;
SELECT * FROM shielded_transactions;
```

## Known Issues

### Sipher API Rate Limiting
If tests fail with 429 errors, the Sipher API rate limit has been hit. Wait a few minutes and retry.

### Database Connection Timeouts
If tests hang, check that Supabase is running and accessible:
```bash
curl http://localhost:54321/rest/v1/
```

### Test Data Cleanup
If tests fail during cleanup, you may need to manually delete test data:
```sql
-- Delete test viewing keys
DELETE FROM viewing_keys WHERE path LIKE 'm/0%';

-- Delete test disclosures
DELETE FROM disclosures WHERE auditor_id LIKE 'test-%';

-- Delete test transactions
DELETE FROM shielded_transactions WHERE tx_signature LIKE 'test-%';
```

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Add graceful skipping for missing dependencies
3. Clean up all test data in `afterAll`
4. Use descriptive test names
5. Add comments explaining complex test logic
6. Update this README with new test coverage

## References

- [Sipher Privacy Integration Spec](.kiro/specs/sipher-privacy-integration/)
- [Sipher API Documentation](https://github.com/sip-protocol/sipher)
- [Vitest Documentation](https://vitest.dev/)
- [Supabase Documentation](https://supabase.com/docs)
