import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../services/supabase';
import { SipherClient } from '../services/privacy/sipher-client';
import { getViewingKeyManager, initializeViewingKeyManager } from '../services/privacy/viewing-key-manager';
import { getDisclosureService, initializeDisclosureService } from '../services/privacy/disclosure-service';
import { getComplianceService, initializeComplianceService } from '../services/privacy/compliance-service';
import { getMultiSigService, initializeMultiSigService } from '../services/privacy/multi-sig-service';
import { getEncryptionService } from '../services/privacy/encryption-service';
import { config } from '../config';

const router = Router();

/**
 * Compliance API Routes
 * 
 * Provides REST endpoints for Phase 3 compliance features:
 * 
 * - Hierarchical viewing key management
 * - Selective transaction disclosure
 * - Compliance reporting
 * - Multi-signature master key approval
 * 
 * Requirements: 12.1, 13.1, 14.1, 15.1, 16.1, 17.1
 */

/**
 * Simple AML service mock for demonstration
 * In production, integrate with real AML/CFT service
 */
const mockAMLService = {
  async checkTransaction(txData: any) {
    return {
      compliant: true,
      riskScore: 15,
      flags: []
    };
  }
};

/**
 * Initialize services lazily
 */
let servicesInitialized = false;

function initializeServices() {
  if (servicesInitialized) return;

  const sipherClient = new SipherClient({
    baseUrl: config.sipher.url,
    apiKey: config.sipher.apiKey
  });
  const supabase = getSupabaseClient();
  const encryption = getEncryptionService();

  // Initialize viewing key manager
  initializeViewingKeyManager(sipherClient, supabase, encryption);

  // Initialize disclosure service
  initializeDisclosureService(sipherClient, supabase);

  // Initialize compliance service
  const viewingKeyManager = getViewingKeyManager();
  const disclosureService = getDisclosureService();
  initializeComplianceService(
    sipherClient,
    viewingKeyManager,
    disclosureService,
    supabase,
    mockAMLService
  );

  // Initialize multi-sig service
  initializeMultiSigService(supabase);

  servicesInitialized = true;
}

// ============================================================================
// Viewing Key Management
// ============================================================================

/**
 * POST /api/compliance/viewing-key/generate
 * 
 * Generate master viewing key (m/0)
 * 
 * Body:
 * - path?: string - Derivation path (default: 'm/0')
 * 
 * Response:
 * - id: number - Viewing key ID
 * - keyHash: string - Key hash for verification
 * - path: string - Derivation path
 * - role: string - Key role (master)
 * - createdAt: string - Creation timestamp
 * 
 * Requirements: 12.1
 */
router.post('/viewing-key/generate', async (req: Request, res: Response) => {
  try {
    initializeServices();

    const { path = 'm/0' } = req.body;

    const viewingKeyManager = getViewingKeyManager();
    const viewingKey = await viewingKeyManager.generateMaster(path);

    res.json({
      success: true,
      data: {
        id: viewingKey.id,
        keyHash: viewingKey.keyHash,
        path: viewingKey.path,
        role: viewingKey.role,
        createdAt: viewingKey.createdAt.toISOString()
      }
    });
  } catch (error: any) {
    console.error('Failed to generate master viewing key:', error);
    res.status(500).json({
      error: 'Failed to generate master viewing key',
      message: error.message
    });
  }
});

/**
 * POST /api/compliance/viewing-key/derive
 * 
 * Derive child viewing key from parent (BIP32-style)
 * 
 * Body:
 * - parentId: number - Parent viewing key ID
 * - childPath: string - Child path segment (e.g., 'org', '2026', 'Q1')
 * 
 * Response:
 * - id: number - Viewing key ID
 * - keyHash: string - Key hash for verification
 * - path: string - Full derivation path
 * - parentHash: string - Parent key hash
 * - role: string - Key role (internal/external/regulator)
 * - expiresAt?: string - Expiration timestamp
 * - createdAt: string - Creation timestamp
 * 
 * Requirements: 12.2
 */
router.post('/viewing-key/derive', async (req: Request, res: Response) => {
  try {
    initializeServices();

    const { parentId, childPath } = req.body;

    if (!parentId || !childPath) {
      return res.status(400).json({
        error: 'Missing required fields: parentId, childPath'
      });
    }

    const viewingKeyManager = getViewingKeyManager();
    const childKey = await viewingKeyManager.derive(
      parseInt(parentId),
      childPath
    );

    res.json({
      success: true,
      data: {
        id: childKey.id,
        keyHash: childKey.keyHash,
        path: childKey.path,
        parentHash: childKey.parentHash,
        role: childKey.role,
        expiresAt: childKey.expiresAt?.toISOString(),
        createdAt: childKey.createdAt.toISOString()
      }
    });
  } catch (error: any) {
    console.error('Failed to derive child viewing key:', error);
    res.status(500).json({
      error: 'Failed to derive child viewing key',
      message: error.message
    });
  }
});

/**
 * POST /api/compliance/viewing-key/verify
 * 
 * Verify parent-child viewing key hierarchy
 * 
 * Body:
 * - parentId: number - Parent viewing key ID
 * - childId: number - Child viewing key ID
 * 
 * Response:
 * - valid: boolean - Whether hierarchy is valid
 * 
 * Requirements: 13.1, 13.2
 */
router.post('/viewing-key/verify', async (req: Request, res: Response) => {
  try {
    initializeServices();

    const { parentId, childId } = req.body;

    if (!parentId || !childId) {
      return res.status(400).json({
        error: 'Missing required fields: parentId, childId'
      });
    }

    const viewingKeyManager = getViewingKeyManager();
    const valid = await viewingKeyManager.verifyHierarchy(
      parseInt(parentId),
      parseInt(childId)
    );

    res.json({
      success: true,
      data: { valid }
    });
  } catch (error: any) {
    console.error('Failed to verify viewing key hierarchy:', error);
    res.status(500).json({
      error: 'Failed to verify viewing key hierarchy',
      message: error.message
    });
  }
});

// ============================================================================
// Transaction Disclosure
// ============================================================================

/**
 * POST /api/compliance/disclose
 * 
 * Disclose transaction to auditor with role-based viewing key
 * 
 * Body:
 * - transactionId: number - Transaction ID to disclose
 * - auditorId: string - Auditor identifier
 * - role: string - Auditor role (internal/external/regulator)
 * 
 * Response:
 * - id: number - Disclosure ID
 * - transactionId: number - Transaction ID
 * - auditorId: string - Auditor identifier
 * - viewingKeyHash: string - Viewing key hash used
 * - disclosedFields: string[] - Fields disclosed to auditor
 * - expiresAt: string - Disclosure expiration timestamp
 * - createdAt: string - Disclosure creation timestamp
 * 
 * Requirements: 14.1, 14.2
 */
router.post('/disclose', async (req: Request, res: Response) => {
  try {
    initializeServices();

    const { transactionId, auditorId, role } = req.body;

    if (!transactionId || !auditorId || !role) {
      return res.status(400).json({
        error: 'Missing required fields: transactionId, auditorId, role'
      });
    }

    // Validate role
    const validRoles = ['internal', 'external', 'regulator'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    const complianceService = getComplianceService();
    const disclosure = await complianceService.discloseToAuditor(
      parseInt(transactionId),
      auditorId,
      role as 'internal' | 'external' | 'regulator'
    );

    res.json({
      success: true,
      data: {
        id: disclosure.id,
        transactionId: disclosure.transactionId,
        auditorId: disclosure.auditorId,
        viewingKeyHash: disclosure.viewingKeyHash,
        disclosedFields: disclosure.disclosedFields,
        expiresAt: disclosure.expiresAt.toISOString(),
        createdAt: disclosure.createdAt.toISOString()
      }
    });
  } catch (error: any) {
    console.error('Failed to disclose transaction:', error);
    res.status(500).json({
      error: 'Failed to disclose transaction',
      message: error.message
    });
  }
});

/**
 * POST /api/compliance/decrypt
 * 
 * Decrypt disclosed transaction data with viewing key
 * 
 * Body:
 * - disclosureId: number - Disclosure ID
 * - viewingKeyHash: string - Viewing key hash for decryption
 * 
 * Response:
 * - sender: string - Transaction sender
 * - recipient: string - Transaction recipient (stealth address)
 * - amount: string - Transaction amount
 * - timestamp: number - Transaction timestamp
 * - txSignature?: string - Transaction signature
 * 
 * Requirements: 15.1, 15.2
 */
router.post('/decrypt', async (req: Request, res: Response) => {
  try {
    initializeServices();

    const { disclosureId, viewingKeyHash } = req.body;

    if (!disclosureId || !viewingKeyHash) {
      return res.status(400).json({
        error: 'Missing required fields: disclosureId, viewingKeyHash'
      });
    }

    // Get viewing key by hash
    const viewingKeyManager = getViewingKeyManager();
    const viewingKey = await viewingKeyManager.getByHash(viewingKeyHash);

    if (!viewingKey) {
      return res.status(404).json({
        error: 'Viewing key not found'
      });
    }

    // Check if viewing key is expired
    if (viewingKey.expiresAt && viewingKey.expiresAt < new Date()) {
      return res.status(403).json({
        error: 'Viewing key has expired'
      });
    }

    // Check if viewing key is revoked
    if (viewingKey.revokedAt) {
      return res.status(403).json({
        error: 'Viewing key has been revoked'
      });
    }

    // Verify compliance and decrypt
    const complianceService = getComplianceService();
    const report = await complianceService.verifyCompliance(
      parseInt(disclosureId),
      {
        key: '', // Will be populated by service
        path: viewingKey.path,
        hash: viewingKey.keyHash
      }
    );

    // Get disclosure to extract decrypted data
    const disclosureService = getDisclosureService();
    const supabase = getSupabaseClient();
    const { data: disclosure, error } = await supabase
      .from('disclosures')
      .select('*')
      .eq('id', parseInt(disclosureId))
      .single();

    if (error || !disclosure) {
      return res.status(404).json({
        error: 'Disclosure not found'
      });
    }

    // Decrypt the data
    const decrypted = await disclosureService.decrypt(
      disclosure.encrypted_data,
      {
        key: '', // Will be populated by service
        path: viewingKey.path,
        hash: viewingKey.keyHash
      }
    );

    res.json({
      success: true,
      data: {
        ...decrypted,
        compliance: {
          compliant: report.compliant,
          riskScore: report.riskScore,
          flags: report.flags
        }
      }
    });
  } catch (error: any) {
    console.error('Failed to decrypt disclosure:', error);
    res.status(500).json({
      error: 'Failed to decrypt disclosure',
      message: error.message
    });
  }
});

/**
 * GET /api/compliance/disclosures/:auditorId
 * 
 * List all disclosures for an auditor
 * 
 * Params:
 * - auditorId: string - Auditor identifier
 * 
 * Query:
 * - includeRevoked?: boolean - Include revoked disclosures (default: false)
 * 
 * Response:
 * - disclosures: Array - List of disclosure records
 * - total: number - Total number of disclosures
 * 
 * Requirements: 14.3
 */
router.get('/disclosures/:auditorId', async (req: Request, res: Response) => {
  try {
    initializeServices();

    const { auditorId } = req.params;
    const includeRevoked = req.query.includeRevoked === 'true';

    const disclosureService = getDisclosureService();
    let disclosures = await disclosureService.listDisclosures(auditorId);

    // Filter out revoked if not requested
    if (!includeRevoked) {
      disclosures = disclosures.filter(d => !d.revokedAt);
    }

    res.json({
      success: true,
      data: {
        disclosures: disclosures.map(d => ({
          id: d.id,
          transactionId: d.transactionId,
          auditorId: d.auditorId,
          viewingKeyHash: d.viewingKeyHash,
          disclosedFields: d.disclosedFields,
          expiresAt: d.expiresAt.toISOString(),
          createdAt: d.createdAt.toISOString(),
          revokedAt: d.revokedAt?.toISOString()
        })),
        total: disclosures.length
      }
    });
  } catch (error: any) {
    console.error('Failed to list disclosures:', error);
    res.status(500).json({
      error: 'Failed to list disclosures',
      message: error.message
    });
  }
});

// ============================================================================
// Compliance Reporting
// ============================================================================

/**
 * POST /api/compliance/report
 * 
 * Generate compliance report for date range
 * 
 * Body:
 * - startDate: string - Start date (ISO 8601)
 * - endDate: string - End date (ISO 8601)
 * - role: string - Auditor role (internal/external/regulator/master)
 * - format?: string - Report format (json/pdf, default: json)
 * 
 * Response:
 * - transactions: number - Total transactions in period
 * - compliant: number - Number of compliant transactions
 * - flagged: number - Number of flagged transactions
 * - report: Array - Detailed compliance reports
 * - generatedAt: string - Report generation timestamp
 * 
 * Requirements: 17.1, 17.2, 17.3
 */
router.post('/report', async (req: Request, res: Response) => {
  try {
    initializeServices();

    const { startDate, endDate, role, format = 'json' } = req.body;

    if (!startDate || !endDate || !role) {
      return res.status(400).json({
        error: 'Missing required fields: startDate, endDate, role'
      });
    }

    // Validate role
    const validRoles = ['internal', 'external', 'regulator', 'master'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)'
      });
    }

    if (start > end) {
      return res.status(400).json({
        error: 'Start date must be before end date'
      });
    }

    const complianceService = getComplianceService();
    const report = await complianceService.generateReport(
      { start, end },
      role
    );

    // Format response based on requested format
    if (format === 'pdf') {
      // TODO: Implement PDF generation
      return res.status(501).json({
        error: 'PDF format not yet implemented',
        message: 'Use format=json for now'
      });
    }

    res.json({
      success: true,
      data: {
        ...report,
        dateRange: {
          start: start.toISOString(),
          end: end.toISOString()
        },
        role,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Failed to generate compliance report:', error);
    res.status(500).json({
      error: 'Failed to generate compliance report',
      message: error.message
    });
  }
});

// ============================================================================
// Multi-Signature Master Key Approval
// ============================================================================

/**
 * POST /api/compliance/master-key/approve
 * 
 * Request or approve master viewing key access with multi-signature
 * 
 * Body:
 * - action: string - Action type ('request' or 'sign')
 * - requester?: string - Requester identifier (for 'request' action)
 * - requestId?: string - Request ID (for 'sign' action)
 * - signer?: string - Signer identifier (for 'sign' action)
 * - signature?: string - Cryptographic signature (for 'sign' action)
 * 
 * Response (request):
 * - requestId: string - Approval request ID
 * - threshold: number - Required number of signatures
 * - status: string - Request status (pending)
 * 
 * Response (sign):
 * - requestId: string - Approval request ID
 * - signatures: number - Current number of signatures
 * - threshold: number - Required number of signatures
 * - status: string - Request status (pending/approved)
 * - approved: boolean - Whether threshold is met
 * 
 * Requirements: 16.5
 */
router.post('/master-key/approve', async (req: Request, res: Response) => {
  try {
    initializeServices();

    const { action, requester, requestId, signer, signature } = req.body;

    if (!action) {
      return res.status(400).json({
        error: 'Missing required field: action'
      });
    }

    const multiSigService = getMultiSigService();

    if (action === 'request') {
      // Create new approval request
      if (!requester) {
        return res.status(400).json({
          error: 'Missing required field: requester'
        });
      }

      const approval = await multiSigService.createApprovalRequest(requester);

      res.json({
        success: true,
        data: {
          requestId: approval.requestId,
          threshold: approval.threshold,
          status: approval.status,
          createdAt: approval.createdAt.toISOString()
        }
      });
    } else if (action === 'sign') {
      // Add signature to existing request
      if (!requestId || !signer || !signature) {
        return res.status(400).json({
          error: 'Missing required fields: requestId, signer, signature'
        });
      }

      const approval = await multiSigService.addSignature(
        requestId,
        signer,
        signature
      );

      res.json({
        success: true,
        data: {
          requestId: approval.requestId,
          signatures: approval.signatures.length,
          threshold: approval.threshold,
          status: approval.status,
          approved: approval.status === 'approved',
          approvedAt: approval.approvedAt?.toISOString()
        }
      });
    } else {
      return res.status(400).json({
        error: `Invalid action: ${action}. Must be 'request' or 'sign'`
      });
    }
  } catch (error: any) {
    console.error('Failed to process master key approval:', error);
    res.status(500).json({
      error: 'Failed to process master key approval',
      message: error.message
    });
  }
});

/**
 * GET /api/compliance/master-key/status/:requestId
 * 
 * Check status of master key approval request
 * 
 * Params:
 * - requestId: string - Approval request ID
 * 
 * Response:
 * - requestId: string - Approval request ID
 * - status: string - Request status
 * - approved: boolean - Whether threshold is met
 */
router.get('/master-key/status/:requestId', async (req: Request, res: Response) => {
  try {
    initializeServices();

    const { requestId } = req.params;

    const multiSigService = getMultiSigService();
    const approved = await multiSigService.isApproved(requestId);

    res.json({
      success: true,
      data: {
        requestId,
        status: approved ? 'approved' : 'pending',
        approved
      }
    });
  } catch (error: any) {
    console.error('Failed to check approval status:', error);
    res.status(500).json({
      error: 'Failed to check approval status',
      message: error.message
    });
  }
});

// ============================================================================
// Utility Endpoints
// ============================================================================

/**
 * POST /api/compliance/setup
 * 
 * Setup complete viewing key hierarchy
 * 
 * Response:
 * - master: ViewingKeyRecord - Master key (m/0)
 * - org: ViewingKeyRecord - Organizational key (m/0/org)
 * - year: ViewingKeyRecord - Yearly key (m/0/org/YYYY)
 * - quarter: ViewingKeyRecord - Quarterly key (m/0/org/YYYY/QN)
 */
router.post('/setup', async (req: Request, res: Response) => {
  try {
    initializeServices();

    const complianceService = getComplianceService();
    const hierarchy = await complianceService.setupHierarchy();

    res.json({
      success: true,
      data: {
        master: {
          id: hierarchy.master.id,
          keyHash: hierarchy.master.keyHash,
          path: hierarchy.master.path,
          role: hierarchy.master.role
        },
        org: {
          id: hierarchy.org.id,
          keyHash: hierarchy.org.keyHash,
          path: hierarchy.org.path,
          role: hierarchy.org.role
        },
        year: {
          id: hierarchy.year.id,
          keyHash: hierarchy.year.keyHash,
          path: hierarchy.year.path,
          role: hierarchy.year.role
        },
        quarter: {
          id: hierarchy.quarter.id,
          keyHash: hierarchy.quarter.keyHash,
          path: hierarchy.quarter.path,
          role: hierarchy.quarter.role
        }
      }
    });
  } catch (error: any) {
    console.error('Failed to setup viewing key hierarchy:', error);
    res.status(500).json({
      error: 'Failed to setup viewing key hierarchy',
      message: error.message
    });
  }
});

export default router;
