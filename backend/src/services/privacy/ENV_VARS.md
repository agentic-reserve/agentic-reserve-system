# Privacy Service Environment Variables

This document describes all environment variables used by the Sipher Privacy Integration.

## Sipher API Configuration

### `SIPHER_API_URL`
- **Type**: String (URL)
- **Default**: `https://sipher.sip-protocol.org`
- **Description**: Base URL for the Sipher Privacy-as-a-Skill REST API
- **Required**: Yes (when `PRIVACY_ENABLED=true`)
- **Example**: `https://sipher.sip-protocol.org`

### `SIPHER_API_KEY`
- **Type**: String
- **Default**: None
- **Description**: API key for authenticating with Sipher API (X-API-Key header)
- **Required**: Yes (when `PRIVACY_ENABLED=true`)
- **Example**: `sk_test_1234567890abcdef`
- **Note**: Obtain from Sipher dashboard or contact Sipher team

### `SIPHER_ENABLED`
- **Type**: Boolean
- **Default**: `true`
- **Description**: Enable/disable Sipher API integration
- **Required**: No
- **Values**: `true` | `false`

### `SIPHER_TIMEOUT`
- **Type**: Number (milliseconds)
- **Default**: `30000` (30 seconds)
- **Description**: Request timeout for Sipher API calls
- **Required**: No
- **Example**: `30000`

## Privacy Features

### `PRIVACY_ENABLED`
- **Type**: Boolean
- **Default**: `true`
- **Description**: Master switch for all privacy features
- **Required**: No
- **Values**: `true` | `false`
- **Note**: When `false`, privacy routes and services are disabled

### `MEV_PROTECTION_ENABLED`
- **Type**: Boolean
- **Default**: `false`
- **Description**: Enable MEV-protected vault rebalancing (Phase 2 feature)
- **Required**: No
- **Values**: `true` | `false`
- **Note**: Requires Phase 2 implementation

### `COMPLIANCE_MODE`
- **Type**: String (enum)
- **Default**: `selective`
- **Description**: Compliance disclosure mode
- **Required**: No
- **Values**: 
  - `none` - No compliance features
  - `selective` - Selective disclosure with viewing keys (Phase 3)
  - `full` - Full transaction disclosure
- **Note**: Phase 3 feature

## Privacy Thresholds

### `PRIVACY_SCORE_THRESHOLD`
- **Type**: Number (0-100)
- **Default**: `70`
- **Description**: Minimum privacy score required for unprotected operations
- **Required**: No
- **Example**: `70`
- **Note**: Vaults below this score are flagged for enhanced MEV protection

### `MEV_REDUCTION_TARGET`
- **Type**: Number (percentage)
- **Default**: `80`
- **Description**: Target MEV extraction reduction percentage
- **Required**: No
- **Example**: `80`
- **Note**: Phase 2 feature

## Key Management

### `KEY_ROTATION_DAYS`
- **Type**: Number (days)
- **Default**: `90`
- **Description**: Number of days before keys should be rotated
- **Required**: No
- **Example**: `90`
- **Note**: Quarterly rotation recommended

### `VIEWING_KEY_EXPIRATION_DAYS`
- **Type**: Number (days)
- **Default**: `30`
- **Description**: Default expiration time for viewing keys
- **Required**: No
- **Example**: `30`
- **Note**: Phase 3 feature

### `MASTER_KEY_MULTISIG_THRESHOLD`
- **Type**: Number
- **Default**: `3`
- **Description**: Minimum number of signatures required for master viewing key access
- **Required**: No
- **Example**: `3`
- **Note**: Phase 3 feature, M-of-N multi-signature

## Payment Scanning Configuration

### `PAYMENT_SCAN_INTERVAL_SECONDS`
- **Type**: Number (seconds)
- **Default**: `60`
- **Description**: Interval between payment scans
- **Required**: No
- **Example**: `60`
- **Note**: Lower values increase API usage but reduce payment detection latency

### `PAYMENT_SCAN_BATCH_SIZE`
- **Type**: Number
- **Default**: `100`
- **Description**: Maximum number of transactions to process per scan
- **Required**: No
- **Example**: `100`
- **Range**: 1-1000

### `PAYMENT_SCAN_RETRY_ATTEMPTS`
- **Type**: Number
- **Default**: `5`
- **Description**: Number of retry attempts for failed scans
- **Required**: No
- **Example**: `5`
- **Note**: Uses exponential backoff (1s, 2s, 4s, 8s, 16s)

## Encryption Configuration

### `ENCRYPTION_ALGORITHM`
- **Type**: String
- **Default**: `aes-256-gcm`
- **Description**: Encryption algorithm for private key storage
- **Required**: No
- **Values**: `aes-256-gcm` (only supported value)
- **Note**: AES-256-GCM provides authenticated encryption

### `ENCRYPTION_KEY_DERIVATION`
- **Type**: String
- **Default**: `pbkdf2`
- **Description**: Key derivation function for encryption keys
- **Required**: No
- **Values**: `pbkdf2` (only supported value)
- **Note**: PBKDF2 with SHA-256

### `ENCRYPTION_ITERATIONS`
- **Type**: Number
- **Default**: `100000`
- **Description**: Number of PBKDF2 iterations for key derivation
- **Required**: No
- **Example**: `100000`
- **Note**: OWASP recommends minimum 100,000 iterations
- **Warning**: Lower values reduce security

## Configuration Examples

### Development (Local)
```bash
SIPHER_API_URL=https://sipher.sip-protocol.org
SIPHER_API_KEY=sk_test_1234567890abcdef
SIPHER_ENABLED=true
PRIVACY_ENABLED=true
PAYMENT_SCAN_INTERVAL_SECONDS=60
ENCRYPTION_ITERATIONS=100000
```

### Production
```bash
SIPHER_API_URL=https://sipher.sip-protocol.org
SIPHER_API_KEY=sk_live_abcdef1234567890
SIPHER_ENABLED=true
PRIVACY_ENABLED=true
MEV_PROTECTION_ENABLED=true
COMPLIANCE_MODE=selective
PRIVACY_SCORE_THRESHOLD=70
PAYMENT_SCAN_INTERVAL_SECONDS=30
ENCRYPTION_ITERATIONS=100000
KEY_ROTATION_DAYS=90
```

### Testing
```bash
SIPHER_API_URL=https://sipher-test.sip-protocol.org
SIPHER_API_KEY=sk_test_1234567890abcdef
SIPHER_ENABLED=true
PRIVACY_ENABLED=true
PAYMENT_SCAN_INTERVAL_SECONDS=120
ENCRYPTION_ITERATIONS=10000  # Lower for faster tests
```

## Security Considerations

1. **API Keys**: Never commit API keys to version control. Use environment variables or secret management systems.

2. **Encryption Iterations**: Do not reduce below 100,000 in production. Lower values significantly reduce security.

3. **Key Rotation**: Implement automated key rotation based on `KEY_ROTATION_DAYS`.

4. **Scan Interval**: Balance between API usage costs and payment detection latency.

5. **Privacy Score**: Monitor privacy scores and adjust threshold based on threat model.

## Troubleshooting

### "Sipher client not initialized"
- Ensure `SIPHER_API_KEY` is set
- Verify `PRIVACY_ENABLED=true`
- Check that Sipher client is initialized in app startup

### "Invalid Sipher API key"
- Verify API key is correct
- Check API key has not expired
- Ensure using correct environment (test vs. production)

### "Payment scan failed"
- Check Sipher API is accessible
- Verify agent has valid stealth address
- Review `PAYMENT_SCAN_RETRY_ATTEMPTS` setting

### "Encryption failed"
- Verify `ENCRYPTION_ALGORITHM=aes-256-gcm`
- Check `ENCRYPTION_ITERATIONS` is valid number
- Ensure agent ID is provided for key derivation

## References

- [Sipher API Documentation](https://github.com/sip-protocol/sipher)
- [AES-256-GCM Specification](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
- [PBKDF2 Specification](https://tools.ietf.org/html/rfc2898)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
