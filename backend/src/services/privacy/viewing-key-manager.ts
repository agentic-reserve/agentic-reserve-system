import { createHash } from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import { SipherClient, ViewingKey } from './sipher-client';
import { EncryptionService } from './encryption-service';

/**
 * Simple logger utility
 */
const logger = {
  info: (message: string, context?: any) => console.log(`[INFO] ${message}`, context || ''),
  warn: (message: string, context?: any) => console.warn(`[WARN] ${message}`, context || ''),
  error: (message: string, context?: any) => console.error(`[ERROR] ${message}`, context || '')
};

/**
 * Viewing key role types
 */
export type ViewingKeyRole = 'internal' | 'external' | 'regulator' | 'master';

/**
 * Viewing key record from database
 */
export interface ViewingKeyRecord {
  id: number;
  keyHash: string;
  encryptedKey: string;
  path: string;
  parentHash?: string;
  role: ViewingKeyRole;
  expiresAt?: Date;
  createdAt: Date;
  revokedAt?: Date;
}

/**
 * Viewing Key Manager
 * 
 * Manages hierarchical viewing keys for compliance and selective disclosure.
 * Implements BIP32-style key derivation for role-based access control.
 * 
 * Hierarchy:
 * - m/0 (master): Complete access, requires multi-sig
 * - m/0/org (organizational): Regulatory access
 * - m/0/org/2026 (yearly): External audit access
 * - m/0/org/2026/Q1 (quarterly): Internal audit access
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.5, 13.1, 13.2
 */
export class ViewingKeyManager {
  private sipherClient: SipherClient;
  private database: SupabaseClient;
  private encryption: EncryptionService;
  private protocolMasterKey: string;

  constructor(
    sipherClient: SipherClient,
    database: SupabaseClient,
    encryption: EncryptionService,
    protocolMasterKey?: string
  ) {
    this.sipherClient = sipherClient;
    this.database = database;
    this.encryption = encryption;
    
    // SECURITY FIX (VULN-002): Enforce secure master key requirement
    this.protocolMasterKey = protocolMasterKey || process.env.PROTOCOL_MASTER_KEY || '';
    
    if (!this.protocolMasterKey) {
      throw new Error(
        'PROTOCOL_MASTER_KEY is required. Set environment variable or provide via constructor. ' +
        'For production, use HSM-backed key management.'
      );
    }
    
    if (this.protocolMasterKey.length < 32) {
      throw new Error('Protocol master key must be at least 32 characters');
    }
    
    // Validate key is not a common/default value
    const insecureKeys = ['default-master-key', 'test-key', 'master-key', 'password', 'protocol-key'];
    if (insecureKeys.includes(this.protocolMasterKey.toLowerCase())) {
      throw new Error('Protocol master key appears to be a default/test value. Use a cryptographically secure key.');
    }
    
    logger.info('ViewingKeyManager initialized with secure protocol master key');
  }

  /**
   * Generate master viewing key (m/0)
   * 
   * @param path - Derivation path (default: 'm/0')
   * @returns Viewing key record
   */
  async generateMaster(path: string = 'm/0'): Promise<ViewingKeyRecord> {
    try {
      logger.info(`Generating master viewing key: ${path}`);

      // Validate path format
      if (!path.startsWith('m/')) {
        throw new Error(`Invalid path format: ${path}. Must start with 'm/'`);
      }

      // Generate viewing key via Sipher API
      const viewingKey = await this.sipherClient.generateViewingKey(path);

      // Encrypt the viewing key
      const encryptedKey = await this.encryptKey(viewingKey.key);

      // Store in database
      const record = await this.storeViewingKey({
        keyHash: viewingKey.hash,
        encryptedKey,
        path: viewingKey.path,
        parentHash: undefined,
        role: this.determineRole(path),
        expiresAt: undefined // Master keys don't expire
      });

      logger.info(`Master viewing key generated: ${record.keyHash}`);
      return record;
    } catch (error) {
      logger.error('Failed to generate master viewing key', { error, path });
      throw error;
    }
  }

  /**
   * Derive child viewing key from parent (BIP32-style)
   * 
   * @param parentId - Parent viewing key ID
   * @param childPath - Child path segment (e.g., 'org', '2026', 'Q1')
   * @returns Derived viewing key record
   */
  async derive(parentId: number, childPath: string): Promise<ViewingKeyRecord> {
    try {
      logger.info(`Deriving child viewing key from parent ${parentId}: ${childPath}`);

      // Get parent viewing key
      const parent = await this.getById(parentId);
      if (!parent) {
        throw new Error(`Parent viewing key not found: ${parentId}`);
      }

      // Check if parent is revoked
      if (parent.revokedAt) {
        throw new Error(`Cannot derive from revoked key: ${parentId}`);
      }

      // Decrypt parent key
      const parentKey = await this.decryptKey(parent.encryptedKey);

      // Construct full child path
      const fullChildPath = `${parent.path}/${childPath}`;

      // Derive child key via Sipher API
      const childViewingKey = await this.sipherClient.deriveViewingKey(
        {
          key: parentKey,
          path: parent.path,
          hash: parent.keyHash
        },
        childPath
      );

      // Encrypt the child key
      const encryptedKey = await this.encryptKey(childViewingKey.key);

      // Determine expiration based on role
      const role = this.determineRole(fullChildPath);
      const expiresAt = this.calculateExpiration(role);

      // Store in database
      const record = await this.storeViewingKey({
        keyHash: childViewingKey.hash,
        encryptedKey,
        path: childViewingKey.path,
        parentHash: parent.keyHash,
        role,
        expiresAt
      });

      logger.info(`Child viewing key derived: ${record.keyHash} (${record.path})`);
      return record;
    } catch (error) {
      logger.error('Failed to derive child viewing key', { error, parentId, childPath });
      throw error;
    }
  }

  /**
   * Verify parent-child viewing key hierarchy
   * 
   * @param parentId - Parent viewing key ID
   * @param childId - Child viewing key ID
   * @returns True if hierarchy is valid
   */
  async verifyHierarchy(parentId: number, childId: number): Promise<boolean> {
    try {
      logger.info(`Verifying hierarchy: parent ${parentId}, child ${childId}`);

      // Get both keys
      const parent = await this.getById(parentId);
      const child = await this.getById(childId);

      if (!parent || !child) {
        logger.warn('Parent or child key not found', { parentId, childId });
        return false;
      }

      // Check if child's parent hash matches parent's hash
      if (child.parentHash !== parent.keyHash) {
        logger.warn('Parent hash mismatch', {
          expected: parent.keyHash,
          actual: child.parentHash
        });
        return false;
      }

      // Check if child path is derived from parent path
      if (!child.path.startsWith(parent.path + '/')) {
        logger.warn('Path hierarchy mismatch', {
          parentPath: parent.path,
          childPath: child.path
        });
        return false;
      }

      // Decrypt keys for Sipher API verification
      const parentKey = await this.decryptKey(parent.encryptedKey);
      const childKey = await this.decryptKey(child.encryptedKey);

      // Extract child path segment
      const childSegment = child.path.substring(parent.path.length + 1);

      // Verify via Sipher API
      const isValid = await this.sipherClient.verifyKeyHierarchy({
        parentKey: {
          key: parentKey,
          path: parent.path,
          hash: parent.keyHash
        },
        childKey: {
          key: childKey,
          path: child.path,
          hash: child.keyHash
        },
        childPath: childSegment
      });

      logger.info(`Hierarchy verification result: ${isValid}`);
      return isValid;
    } catch (error) {
      logger.error('Failed to verify hierarchy', { error, parentId, childId });
      return false;
    }
  }

  /**
   * Get viewing key by ID
   * 
   * @param id - Viewing key ID
   * @returns Viewing key record or null
   */
  async getById(id: number): Promise<ViewingKeyRecord | null> {
    try {
      const { data, error } = await this.database
        .from('viewing_keys')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return null;
        }
        throw error;
      }

      return this.mapToRecord(data);
    } catch (error) {
      logger.error('Failed to get viewing key by ID', { error, id });
      throw error;
    }
  }

  /**
   * Get viewing key by hash
   * 
   * @param hash - Viewing key hash
   * @returns Viewing key record or null
   */
  async getByHash(hash: string): Promise<ViewingKeyRecord | null> {
    try {
      const { data, error } = await this.database
        .from('viewing_keys')
        .select('*')
        .eq('key_hash', hash)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return null;
        }
        throw error;
      }

      return this.mapToRecord(data);
    } catch (error) {
      logger.error('Failed to get viewing key by hash', { error, hash });
      throw error;
    }
  }

  /**
   * Get viewing key by role
   * 
   * @param role - Viewing key role
   * @returns Viewing key record or null (returns first non-revoked key)
   */
  async getByRole(role: ViewingKeyRole): Promise<ViewingKeyRecord | null> {
    try {
      const { data, error } = await this.database
        .from('viewing_keys')
        .select('*')
        .eq('role', role)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return null;
        }
        throw error;
      }

      return this.mapToRecord(data);
    } catch (error) {
      logger.error('Failed to get viewing key by role', { error, role });
      throw error;
    }
  }

  /**
   * Rotate viewing key (generate new key, revoke old)
   * 
   * @param keyId - Viewing key ID to rotate
   * @returns New viewing key record
   */
  async rotate(keyId: number): Promise<ViewingKeyRecord> {
    try {
      logger.info(`Rotating viewing key: ${keyId}`);

      // Get existing key
      const existingKey = await this.getById(keyId);
      if (!existingKey) {
        throw new Error(`Viewing key not found: ${keyId}`);
      }

      // Check if already revoked
      if (existingKey.revokedAt) {
        throw new Error(`Cannot rotate revoked key: ${keyId}`);
      }

      // Generate new key with same path
      let newKey: ViewingKeyRecord;
      
      if (existingKey.parentHash) {
        // This is a derived key, need to re-derive from parent
        const parent = await this.getByHash(existingKey.parentHash);
        if (!parent) {
          throw new Error(`Parent key not found: ${existingKey.parentHash}`);
        }

        // Extract child segment from path
        const childSegment = existingKey.path.substring(parent.path.length + 1);
        newKey = await this.derive(parent.id, childSegment);
      } else {
        // This is a master key, regenerate
        newKey = await this.generateMaster(existingKey.path);
      }

      // Revoke old key
      await this.revoke(keyId);

      logger.info(`Viewing key rotated: ${keyId} -> ${newKey.id}`);
      return newKey;
    } catch (error) {
      logger.error('Failed to rotate viewing key', { error, keyId });
      throw error;
    }
  }

  /**
   * Revoke viewing key
   * 
   * @param keyId - Viewing key ID to revoke
   */
  async revoke(keyId: number): Promise<void> {
    try {
      logger.info(`Revoking viewing key: ${keyId}`);

      const { error } = await this.database
        .from('viewing_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', keyId);

      if (error) {
        throw error;
      }

      logger.info(`Viewing key revoked: ${keyId}`);
    } catch (error) {
      logger.error('Failed to revoke viewing key', { error, keyId });
      throw error;
    }
  }

  /**
   * Encrypt viewing key using protocol master key
   * 
   * @param key - Viewing key to encrypt
   * @returns Encrypted key (JSON string)
   */
  private async encryptKey(key: string): Promise<string> {
    try {
      const encrypted = this.encryption.encrypt(key, this.protocolMasterKey);
      return JSON.stringify(encrypted);
    } catch (error) {
      logger.error('Failed to encrypt viewing key', { error });
      throw new Error('Failed to encrypt viewing key');
    }
  }

  /**
   * Decrypt viewing key using protocol master key
   * 
   * @param encrypted - Encrypted key (JSON string)
   * @returns Decrypted viewing key
   */
  private async decryptKey(encrypted: string): Promise<string> {
    try {
      const encryptedData = JSON.parse(encrypted);
      return this.encryption.decrypt(encryptedData, this.protocolMasterKey);
    } catch (error) {
      logger.error('Failed to decrypt viewing key', { error });
      throw new Error('Failed to decrypt viewing key');
    }
  }

  /**
   * Store viewing key in database
   * 
   * @param params - Viewing key parameters
   * @returns Viewing key record
   */
  private async storeViewingKey(params: {
    keyHash: string;
    encryptedKey: string;
    path: string;
    parentHash?: string;
    role: ViewingKeyRole;
    expiresAt?: Date;
  }): Promise<ViewingKeyRecord> {
    try {
      const { data, error } = await this.database
        .from('viewing_keys')
        .insert({
          key_hash: params.keyHash,
          encrypted_key: params.encryptedKey,
          path: params.path,
          parent_hash: params.parentHash,
          role: params.role,
          expires_at: params.expiresAt?.toISOString()
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapToRecord(data);
    } catch (error) {
      logger.error('Failed to store viewing key', { error, params });
      throw error;
    }
  }

  /**
   * Determine role from derivation path
   * 
   * @param path - Derivation path
   * @returns Viewing key role
   */
  private determineRole(path: string): ViewingKeyRole {
    // m/0 = master
    if (path === 'm/0') {
      return 'master';
    }
    
    // m/0/org = organizational (regulator)
    if (path.match(/^m\/0\/org$/)) {
      return 'regulator';
    }
    
    // m/0/org/YYYY = yearly (external auditor)
    if (path.match(/^m\/0\/org\/\d{4}$/)) {
      return 'external';
    }
    
    // m/0/org/YYYY/QN = quarterly (internal auditor)
    if (path.match(/^m\/0\/org\/\d{4}\/Q[1-4]$/)) {
      return 'internal';
    }
    
    // Default to internal for other paths
    logger.warn(`Unknown path pattern: ${path}, defaulting to internal role`);
    return 'internal';
  }

  /**
   * Calculate expiration date based on role
   * 
   * @param role - Viewing key role
   * @returns Expiration date or undefined for non-expiring keys
   */
  private calculateExpiration(role: ViewingKeyRole): Date | undefined {
    const now = new Date();
    
    switch (role) {
      case 'master':
        // Master keys don't expire
        return undefined;
        
      case 'regulator':
        // Organizational keys expire in 1 year
        return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
        
      case 'external':
        // Yearly keys expire in 90 days
        return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        
      case 'internal':
        // Quarterly keys expire in 30 days (default)
        const expirationDays = parseInt(
          process.env.VIEWING_KEY_EXPIRATION_DAYS || '30',
          10
        );
        return new Date(now.getTime() + expirationDays * 24 * 60 * 60 * 1000);
        
      default:
        return undefined;
    }
  }

  /**
   * Map database row to ViewingKeyRecord
   * 
   * @param data - Database row
   * @returns Viewing key record
   */
  private mapToRecord(data: any): ViewingKeyRecord {
    return {
      id: data.id,
      keyHash: data.key_hash,
      encryptedKey: data.encrypted_key,
      path: data.path,
      parentHash: data.parent_hash,
      role: data.role as ViewingKeyRole,
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      createdAt: new Date(data.created_at),
      revokedAt: data.revoked_at ? new Date(data.revoked_at) : undefined
    };
  }
}

/**
 * Singleton instance
 */
let viewingKeyManagerInstance: ViewingKeyManager | null = null;

/**
 * Initialize ViewingKeyManager singleton
 * 
 * @param sipherClient - Sipher API client
 * @param database - Supabase client
 * @param encryption - Encryption service
 * @param protocolMasterKey - Protocol master key for encrypting viewing keys
 * @returns ViewingKeyManager instance
 */
export function initializeViewingKeyManager(
  sipherClient: SipherClient,
  database: SupabaseClient,
  encryption: EncryptionService,
  protocolMasterKey?: string
): ViewingKeyManager {
  viewingKeyManagerInstance = new ViewingKeyManager(
    sipherClient,
    database,
    encryption,
    protocolMasterKey
  );
  return viewingKeyManagerInstance;
}

/**
 * Get ViewingKeyManager singleton
 * 
 * @returns ViewingKeyManager instance
 * @throws Error if not initialized
 */
export function getViewingKeyManager(): ViewingKeyManager {
  if (!viewingKeyManagerInstance) {
    throw new Error('ViewingKeyManager not initialized. Call initializeViewingKeyManager first.');
  }
  return viewingKeyManagerInstance;
}
