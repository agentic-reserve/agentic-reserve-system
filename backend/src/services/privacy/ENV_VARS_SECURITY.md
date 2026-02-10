# Environment Variables - Security Configuration

## ⚠️ CRITICAL SECURITY REQUIREMENTS

**PRODUCTION DEPLOYMENT CHECKLIST:**

Before deploying to production, you MUST:

1. ✅ Set `BLINDING_FACTOR_ENCRYPTION_KEY` (min 32 chars, cryptographically random)
2. ✅ Set `PROTOCOL_MASTER_KEY` (min 32 chars, cryptographically random)
3. ✅ Configure HSM integration (AWS KMS, Azure Key Vault, or Google Cloud KMS)
4. ✅ Set up audit logging database table
5. ✅ Configure rate limiting with Redis
6. ✅ Register authorized multi-sig signers with public keys
7. ✅ Enable security monitoring and alerting
8. ✅ Review and test all security configurations

**NEVER use default, test, or weak keys in production!**

---

## Critical Encryption Keys

### BLINDING_FACTOR_ENCRYPTION_KEY ⚠️ CRITICAL
- **Description**: Master encryption key for Pedersen commitment blinding factors
- **Default**: None (MUST be set)
- **Required**: **YES - CRITICAL**
- **Security Level**: CRITICAL
- **Minimum Length**: 32 characters
- **Recommended**: 64+ characters, cryptographically random
- **Generation**: `openssl rand -hex 32`
- **Storage**: Store in secure secrets manager
- **Rotation**: Quarterly (90 days)

**⚠️ WARNING**: If this key is compromised, all MEV protection is lost!

### PROTOCOL_MASTER_KEY ⚠️ CRITICAL
- **Description**: Master encryption key for viewing keys
- **Default**: None (MUST be set)
- **Required**: **YES - CRITICAL**
- **Security Level**: CRITICAL
- **Minimum Length**: 32 characters
- **Recommended**: 64+ characters, cryptographically random
- **Generation**: `openssl rand -hex 32`
- **Storage**: Store in HSM or secure secrets manager
- **Rotation**: Quarterly (90 days)

**⚠️ WARNING**: If this key is compromised, all viewing keys and compliance disclosures are compromised!

---

## Key Generation Commands

```bash
# Generate 64-character hex key (32 bytes) - RECOMMENDED
openssl rand -hex 32

# Generate 128-character hex key (64 bytes) - EXTRA SECURE
openssl rand -hex 64

# Generate base64 key
openssl rand -base64 48
```

---

## Example Production Configuration

```bash
# CRITICAL: Encryption Keys (MUST be set with secure values)
BLINDING_FACTOR_ENCRYPTION_KEY=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
PROTOCOL_MASTER_KEY=x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4321098765432

# HSM Configuration (Production)
USE_HSM=true
AWS_REGION=us-east-1
KMS_MASTER_KEY_ID=arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012

# Security Monitoring
ENABLE_AUDIT_LOGGING=true
SECURITY_ALERT_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
ENABLE_INTRUSION_DETECTION=true

# Multi-Sig Configuration
MASTER_KEY_MULTISIG_THRESHOLD=3
```

---

## Security Best Practices

### 1. Key Storage

**Development**:
- Use `.env` file (add to `.gitignore`)
- Never commit keys to version control

**Production**:
- Use AWS Secrets Manager, HashiCorp Vault, or Azure Key Vault
- Enable automatic key rotation
- Use HSM for critical keys
- Implement least-privilege access controls

### 2. Key Rotation

Rotate keys quarterly (every 90 days):

1. Generate new key
2. Update secrets manager
3. Deploy new key to all services
4. Keep old key for grace period (7 days)
5. Revoke old key after grace period

### 3. Monitoring

Monitor for:
- Failed decryption attempts (potential attack)
- Unusual access patterns
- Rate limit violations
- Audit log write failures
- Key rotation failures

---

## Troubleshooting

### Error: "BLINDING_FACTOR_ENCRYPTION_KEY is required"
**Solution**: Set the environment variable with a cryptographically secure key (min 32 chars)

### Error: "Protocol master key must be at least 32 characters"
**Solution**: Generate a longer key using `openssl rand -hex 32`

### Error: "Blinding factor encryption key appears to be a default/test value"
**Solution**: Use a unique, cryptographically random key, not a common word or pattern

### Error: "Multi-sig threshold must be at least 3"
**Solution**: Set `MASTER_KEY_MULTISIG_THRESHOLD=3` or higher

---

## Support

For security-related questions or to report vulnerabilities:
- Email: security@ars-protocol.org
- Security Advisory: See `SECURITY_AUDIT_REPORT.md`

