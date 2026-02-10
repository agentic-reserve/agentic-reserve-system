import { getSipherClient, MetaAddress, StealthAddress } from './sipher-client';
import { getEncryptionService, EncryptedData } from './encryption-service';
import { supabase } from '../supabase';

/**
 * Simple logger utility
 */
const logger = {
  info: (message: string, context?: any) => console.log(`[INFO] ${message}`, context || ''),
  warn: (message: string, context?: any) => console.warn(`[WARN] ${message}`, context || ''),
  error: (message: string, context?: any) => console.error(`[ERROR] ${message}`, context || '')
};

export interface StoredMetaAddress {
  id: number;
  agent_id: string;
  meta_address: MetaAddress;
  spending_private_key_encrypted: string;
  spending_private_key_iv: string;
  spending_private_key_tag: string;
  spending_private_key_salt: string;
  viewing_private_key_encrypted: string;
  viewing_private_key_iv: string;
  viewing_private_key_tag: string;
  viewing_private_key_salt: string;
  label: string;
  created_at: string;
}

/**
 * StealthAddressManager
 * 
 * Manages stealth meta-addresses for agents, including generation, storage, and retrieval.
 * Uses EncryptionService for secure key storage with agent-specific encryption.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
export class StealthAddressManager {
  private encryptionService = getEncryptionService();

  /**
   * Generate and store stealth meta-address for agent
   * 
   * Calls Sipher API to generate meta-address, encrypts private keys using
   * agent public key for key derivation, and stores in database.
   * 
   * @param agentId - Unique identifier for the agent
   * @param label - Human-readable label for the meta-address
   * @returns Object containing database ID and meta-address
   * 
   * Requirements: 1.1, 1.2, 1.3, 1.4
   */
  async generateForAgent(agentId: string, label: string): Promise<{
    id: number;
    metaAddress: MetaAddress;
  }> {
    try {
      logger.info(`Generating stealth address for agent: ${agentId}`);
      
      const sipher = getSipherClient();
      const result = await sipher.generateMetaAddress(label);
      
      // Encrypt private keys using agent public key for key derivation
      // This ensures each agent's keys are encrypted with a unique key
      const spendingEncrypted = this.encryptionService.encrypt(
        result.spendingPrivateKey,
        agentId // Use agentId as the key derivation input
      );
      const viewingEncrypted = this.encryptionService.encrypt(
        result.viewingPrivateKey,
        agentId
      );
      
      // Store in database with encrypted keys
      const { data, error } = await supabase
        .from('stealth_addresses')
        .insert({
          agent_id: agentId,
          meta_address: result.metaAddress,
          spending_private_key_encrypted: spendingEncrypted.encrypted,
          spending_private_key_iv: spendingEncrypted.iv,
          spending_private_key_tag: spendingEncrypted.tag,
          spending_private_key_salt: spendingEncrypted.salt,
          viewing_private_key_encrypted: viewingEncrypted.encrypted,
          viewing_private_key_iv: viewingEncrypted.iv,
          viewing_private_key_tag: viewingEncrypted.tag,
          viewing_private_key_salt: viewingEncrypted.salt,
          label
        })
        .select()
        .single();
      
      if (error) {
        logger.error('Failed to store stealth address', { error, agentId });
        throw new Error(`Database error: ${error.message}`);
      }
      
      logger.info(`Stealth address stored for agent: ${agentId}`, { id: data.id });
      
      return {
        id: data.id,
        metaAddress: result.metaAddress
      };
    } catch (error) {
      logger.error('Failed to generate stealth address for agent', { error, agentId });
      throw error;
    }
  }

  /**
   * Get meta-address by agent ID
   * 
   * Retrieves the most recent meta-address for the specified agent.
   * 
   * @param agentId - Unique identifier for the agent
   * @returns Meta-address or null if not found
   * 
   * Requirements: 1.5
   */
  async getByAgentId(agentId: string): Promise<MetaAddress | null> {
    try {
      const { data, error } = await supabase
        .from('stealth_addresses')
        .select('meta_address')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No address found
        }
        throw new Error(`Database error: ${error.message}`);
      }
      
      return data.meta_address as MetaAddress;
    } catch (error) {
      logger.error('Failed to get meta-address by agent ID', { error, agentId });
      throw error;
    }
  }

  /**
   * Get meta-address (alias for getByAgentId for backward compatibility)
   */
  async getMetaAddress(agentId: string): Promise<MetaAddress | null> {
    return this.getByAgentId(agentId);
  }

  /**
   * Get decrypted private keys for agent
   * 
   * Retrieves and decrypts the spending and viewing private keys for the agent.
   * Uses agent ID for key derivation to ensure proper decryption.
   * 
   * @param agentId - Unique identifier for the agent
   * @returns Object containing decrypted private keys or null if not found
   * 
   * Requirements: 1.3, 1.4
   */
  async getPrivateKeys(agentId: string): Promise<{
    spendingPrivateKey: string;
    viewingPrivateKey: string;
  } | null> {
    try {
      const { data, error } = await supabase
        .from('stealth_addresses')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new Error(`Database error: ${error.message}`);
      }
      
      // Decrypt private keys using EncryptionService
      const spendingEncrypted: EncryptedData = {
        encrypted: data.spending_private_key_encrypted,
        iv: data.spending_private_key_iv,
        tag: data.spending_private_key_tag,
        salt: data.spending_private_key_salt
      };
      
      const viewingEncrypted: EncryptedData = {
        encrypted: data.viewing_private_key_encrypted,
        iv: data.viewing_private_key_iv,
        tag: data.viewing_private_key_tag,
        salt: data.viewing_private_key_salt
      };
      
      const spendingPrivateKey = this.encryptionService.decrypt(spendingEncrypted, agentId);
      const viewingPrivateKey = this.encryptionService.decrypt(viewingEncrypted, agentId);
      
      return {
        spendingPrivateKey,
        viewingPrivateKey
      };
    } catch (error) {
      logger.error('Failed to get private keys', { error, agentId });
      throw error;
    }
  }

  /**
   * Derive stealth address from meta-address
   * 
   * Generates a one-time stealth address for a recipient's meta-address.
   * This address is unlinkable to the recipient's identity.
   * 
   * @param recipientMetaAddress - Recipient's meta-address
   * @returns Stealth address and shared secret
   * 
   * Requirements: 1.1, 1.2
   */
  async deriveStealthAddress(recipientMetaAddress: MetaAddress): Promise<{
    stealthAddress: StealthAddress;
    sharedSecret: string;
  }> {
    try {
      const sipher = getSipherClient();
      return await sipher.deriveStealthAddress(recipientMetaAddress);
    } catch (error) {
      logger.error('Failed to derive stealth address', { error });
      throw error;
    }
  }

  /**
   * Derive stealth address for recipient (alias for deriveStealthAddress)
   */
  async deriveForRecipient(recipientMetaAddress: MetaAddress): Promise<{
    stealthAddress: StealthAddress;
    sharedSecret: string;
  }> {
    return this.deriveStealthAddress(recipientMetaAddress);
  }

  /**
   * Check if agent owns a stealth address
   */
  async checkOwnership(
    agentId: string,
    stealthAddress: StealthAddress
  ): Promise<boolean> {
    try {
      const keys = await this.getPrivateKeys(agentId);
      if (!keys) {
        return false;
      }
      
      const sipher = getSipherClient();
      return await sipher.checkStealthOwnership(
        stealthAddress,
        keys.spendingPrivateKey,
        keys.viewingPrivateKey
      );
    } catch (error) {
      logger.error('Failed to check ownership', { error, agentId });
      throw error;
    }
  }

  /**
   * List all meta-addresses for agent
   */
  async listForAgent(agentId: string): Promise<Array<{
    id: number;
    metaAddress: MetaAddress;
    label: string;
    createdAt: string;
  }>> {
    try {
      const { data, error } = await supabase
        .from('stealth_addresses')
        .select('id, meta_address, label, created_at')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }
      
      return data.map(row => ({
        id: row.id,
        metaAddress: row.meta_address as MetaAddress,
        label: row.label,
        createdAt: row.created_at
      }));
    } catch (error) {
      logger.error('Failed to list stealth addresses', { error, agentId });
      throw error;
    }
  }

  /**
   * Delete stealth address (soft delete - mark as inactive)
   */
  async deleteForAgent(agentId: string, addressId: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('stealth_addresses')
        .update({ active: false })
        .eq('id', addressId)
        .eq('agent_id', agentId);
      
      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }
      
      logger.info(`Stealth address deleted: ${addressId}`);
    } catch (error) {
      logger.error('Failed to delete stealth address', { error, agentId, addressId });
      throw error;
    }
  }

  /**
   * Rotate keys for agent (generate new meta-address)
   */
  async rotateKeys(agentId: string, label: string): Promise<{
    id: number;
    metaAddress: MetaAddress;
  }> {
    try {
      logger.info(`Rotating keys for agent: ${agentId}`);
      
      // Mark old addresses as inactive
      await supabase
        .from('stealth_addresses')
        .update({ active: false })
        .eq('agent_id', agentId);
      
      // Generate new address
      return await this.generateForAgent(agentId, `${label} (rotated)`);
    } catch (error) {
      logger.error('Failed to rotate keys', { error, agentId });
      throw error;
    }
  }
}

// Export singleton instance
let stealthAddressManagerInstance: StealthAddressManager | null = null;

export function getStealthAddressManager(): StealthAddressManager {
  if (!stealthAddressManagerInstance) {
    stealthAddressManagerInstance = new StealthAddressManager();
  }
  return stealthAddressManagerInstance;
}
