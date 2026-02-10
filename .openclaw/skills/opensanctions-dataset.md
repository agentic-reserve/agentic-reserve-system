# OpenSanctions Dataset Integration Skill
## Comprehensive Sanctions and PEP Screening

**Agent Role**: Sanctions Screening Specialist  
**Version**: 1.0.0  
**Last Updated**: 2026-02-10

## Overview

The OpenSanctions Dataset Integration provides comprehensive access to global sanctions lists, politically exposed persons (PEPs), and other entities of regulatory interest. This skill enables the ARS AML/CFT Compliance Agent to perform real-time screening against 300+ official sources including OFAC, UN, EU, FATF, and national regulators worldwide.

## Dataset Location

**Local Path**: `C:\Users\raden\Documents\Hackathon\agentic-reserve-system\dataset\opensanctions\`

**Available Datasets**:
- `opensanctions-full.jsonl` - Complete dataset with all entities
- `opensanctions-sanctions.jsonl` - Sanctions targets only
- `opensanctions-persons.jsonl` - Individual persons (PEPs, sanctioned individuals)
- `opensanctions-companies.jsonl` - Corporate entities
- `opensanctions-crypto.jsonl` - Cryptocurrency addresses and entities
- `opensanctions-targets-only.jsonl` - High-priority targets
- `opensanctions-dataset.jsonl` - Curated dataset for compliance

## Data Sources

OpenSanctions aggregates data from 300+ official sources:

### Sanctions Lists
- **OFAC SDN** (US Treasury Specially Designated Nationals)
- **UN Security Council** Consolidated List
- **EU Sanctions** (European Union)
- **UK OFSI** (Office of Financial Sanctions Implementation)
- **DFAT** (Australian Department of Foreign Affairs and Trade)
- **SECO** (Swiss State Secretariat for Economic Affairs)
- **National sanctions** from 50+ countries

### PEP Lists
- **World Leaders** (current and former)
- **Government Officials** (ministers, legislators)
- **Judicial Officials** (judges, prosecutors)
- **Military Officials** (generals, admirals)
- **State-Owned Enterprise** executives
- **International Organization** officials

### Other Lists
- **Terrorism Financing** entities
- **Proliferation Financing** networks
- **Human Rights Violators**
- **Corruption Cases**
- **Organized Crime** groups
- **Cybercrime** actors

## Data Schema

Each entity in the dataset follows this structure:

```json
{
  "id": "unique-entity-id",
  "schema": "Person|Company|Organization|Vessel|Aircraft|CryptoWallet",
  "properties": {
    "name": ["Primary Name", "Alias 1", "Alias 2"],
    "alias": ["Alternative names"],
    "birthDate": ["1970-01-01"],
    "nationality": ["US", "RU"],
    "address": ["123 Main St, City, Country"],
    "idNumber": ["Passport: 123456789"],
    "cryptoWallets": ["0x1234..."],
    "topics": ["sanction", "sanction.linked", "role.pep"],
    "datasets": ["us_ofac_sdn", "un_sc_sanctions"],
    "countries": ["us", "ru"],
    "notes": ["Sanctioned for..."]
  },
  "referents": ["related-entity-id-1", "related-entity-id-2"],
  "first_seen": "2020-01-01",
  "last_seen": "2026-02-10",
  "target": true
}
```

### Key Fields

**id**: Unique identifier for the entity  
**schema**: Entity type (Person, Company, Organization, Vessel, Aircraft, CryptoWallet)  
**properties.name**: All known names and aliases  
**properties.topics**: Risk categories (sanction, role.pep, crime, etc.)  
**properties.datasets**: Source lists (us_ofac_sdn, un_sc_sanctions, etc.)  
**properties.cryptoWallets**: Associated cryptocurrency addresses  
**target**: Boolean indicating if entity is a direct sanctions target  
**referents**: Related entities (family members, associates, controlled entities)

## Integration with AML/CFT Compliance

### 1. Real-Time Screening

```typescript
interface SanctionsScreening {
  // Screen wallet address
  screenAddress(address: string): Promise<ScreeningResult>;
  
  // Screen entity name
  screenName(name: string): Promise<ScreeningResult>;
  
  // Screen multiple identifiers
  screenEntity(identifiers: EntityIdentifiers): Promise<ScreeningResult>;
}

interface EntityIdentifiers {
  name?: string;
  address?: string;
  cryptoWallet?: string;
  idNumber?: string;
  birthDate?: string;
  nationality?: string;
}

interface ScreeningResult {
  match: boolean;
  confidence: number; // 0-100
  matches: Match[];
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  action: 'BLOCK' | 'FLAG' | 'MONITOR' | 'ALLOW';
}

interface Match {
  entityId: string;
  entityName: string;
  matchType: 'EXACT' | 'FUZZY' | 'ALIAS' | 'RELATED';
  matchScore: number;
  topics: string[];
  datasets: string[];
  notes: string;
}
```

### 2. Fuzzy Matching Algorithm

OpenSanctions data requires fuzzy matching due to:
- Name variations and transliterations
- Spelling errors in source data
- Aliases and known-as names
- Partial matches

**Matching Strategy**:
```typescript
function calculateMatchScore(query: string, entity: Entity): number {
  let score = 0;
  
  // Exact name match: 100 points
  if (entity.properties.name.includes(query)) {
    score = 100;
  }
  
  // Fuzzy name match: 70-95 points (Levenshtein distance)
  else {
    const fuzzyScore = calculateFuzzyScore(query, entity.properties.name);
    score = fuzzyScore;
  }
  
  // Boost for multiple dataset appearances: +5 per dataset
  score += Math.min(entity.properties.datasets.length * 5, 20);
  
  // Boost for direct target: +10
  if (entity.target) {
    score += 10;
  }
  
  // Penalty for old data: -1 per year since last_seen
  const yearsSinceUpdate = calculateYearsSince(entity.last_seen);
  score -= yearsSinceUpdate;
  
  return Math.max(0, Math.min(100, score));
}
```

### 3. Crypto Wallet Screening

Special handling for cryptocurrency addresses:

```typescript
async function screenCryptoWallet(address: string): Promise<ScreeningResult> {
  // Load crypto-specific dataset
  const cryptoEntities = await loadDataset('opensanctions-crypto.jsonl');
  
  // Exact match on crypto wallet addresses
  const exactMatches = cryptoEntities.filter(entity => 
    entity.properties.cryptoWallets?.includes(address)
  );
  
  if (exactMatches.length > 0) {
    return {
      match: true,
      confidence: 100,
      matches: exactMatches.map(toMatch),
      riskLevel: 'CRITICAL',
      action: 'BLOCK'
    };
  }
  
  // Check for related entities (1 hop)
  const relatedMatches = await checkRelatedEntities(address, 1);
  
  if (relatedMatches.length > 0) {
    return {
      match: true,
      confidence: 80,
      matches: relatedMatches,
      riskLevel: 'HIGH',
      action: 'FLAG'
    };
  }
  
  return {
    match: false,
    confidence: 0,
    matches: [],
    riskLevel: 'LOW',
    action: 'ALLOW'
  };
}
```

### 4. PEP Screening

Politically Exposed Persons require enhanced due diligence:

```typescript
async function screenForPEP(entity: EntityIdentifiers): Promise<PEPResult> {
  const pepEntities = await loadDataset('opensanctions-persons.jsonl');
  
  const pepMatches = pepEntities.filter(e => 
    e.properties.topics?.includes('role.pep')
  );
  
  const matches = await fuzzyMatchEntity(entity, pepMatches);
  
  if (matches.length > 0) {
    return {
      isPEP: true,
      pepLevel: determinePEPLevel(matches[0]),
      requiresEDD: true,
      matches: matches
    };
  }
  
  return {
    isPEP: false,
    pepLevel: null,
    requiresEDD: false,
    matches: []
  };
}

function determinePEPLevel(entity: Entity): 'SENIOR' | 'MEDIUM' | 'JUNIOR' {
  const topics = entity.properties.topics || [];
  
  if (topics.includes('role.head_of_state') || 
      topics.includes('role.head_of_government')) {
    return 'SENIOR';
  }
  
  if (topics.includes('role.minister') || 
      topics.includes('role.judge')) {
    return 'SENIOR';
  }
  
  if (topics.includes('role.legislator')) {
    return 'MEDIUM';
  }
  
  return 'JUNIOR';
}
```

## Operational Workflows

### Transaction Screening Workflow

```
1. Transaction Initiated
   ↓
2. Extract Identifiers
   - Wallet address
   - Entity name (if available)
   - Related metadata
   ↓
3. Load Relevant Datasets
   - opensanctions-crypto.jsonl (for wallet screening)
   - opensanctions-sanctions.jsonl (for sanctions check)
   - opensanctions-persons.jsonl (for PEP check)
   ↓
4. Perform Screening
   - Exact match on crypto wallet
   - Fuzzy match on entity name
   - Check related entities (referents)
   ↓
5. Calculate Risk Score
   - Match confidence
   - Entity topics (sanction, crime, etc.)
   - Dataset sources (OFAC, UN, etc.)
   - Target status
   ↓
6. Determine Action
   - CRITICAL (100% match, sanctioned) → BLOCK
   - HIGH (80%+ match, PEP) → FLAG + EDD
   - MEDIUM (60-80% match) → MONITOR
   - LOW (<60% match) → ALLOW + LOG
   ↓
7. Log Result
   - Store screening result
   - Update compliance metrics
   - Generate alert if needed
```

### Daily Dataset Update Workflow

```
1. Scheduled Update (Daily at 00:00 UTC)
   ↓
2. Download Latest Datasets
   - opensanctions.org API
   - Verify checksums
   - Validate JSON structure
   ↓
3. Compare with Existing Data
   - Identify new entities
   - Identify removed entities
   - Identify updated entities
   ↓
4. Update Local Datasets
   - Replace old files
   - Maintain version history
   - Update metadata
   ↓
5. Re-Screen Active Entities
   - Check all monitored addresses
   - Check all flagged entities
   - Generate alerts for new matches
   ↓
6. Generate Update Report
   - New sanctions added
   - Sanctions removed
   - PEP status changes
   - Notify compliance team
```

## Performance Optimization

### 1. Indexing Strategy

```typescript
// Build in-memory indexes for fast lookup
interface DatasetIndexes {
  byName: Map<string, Entity[]>;
  byCryptoWallet: Map<string, Entity>;
  byDataset: Map<string, Entity[]>;
  byTopic: Map<string, Entity[]>;
  byCountry: Map<string, Entity[]>;
}

async function buildIndexes(dataset: Entity[]): Promise<DatasetIndexes> {
  const indexes: DatasetIndexes = {
    byName: new Map(),
    byCryptoWallet: new Map(),
    byDataset: new Map(),
    byTopic: new Map(),
    byCountry: new Map()
  };
  
  for (const entity of dataset) {
    // Index by name
    for (const name of entity.properties.name || []) {
      const normalized = normalizeName(name);
      if (!indexes.byName.has(normalized)) {
        indexes.byName.set(normalized, []);
      }
      indexes.byName.get(normalized)!.push(entity);
    }
    
    // Index by crypto wallet
    for (const wallet of entity.properties.cryptoWallets || []) {
      indexes.byCryptoWallet.set(wallet.toLowerCase(), entity);
    }
    
    // Index by dataset
    for (const dataset of entity.properties.datasets || []) {
      if (!indexes.byDataset.has(dataset)) {
        indexes.byDataset.set(dataset, []);
      }
      indexes.byDataset.get(dataset)!.push(entity);
    }
    
    // Index by topic
    for (const topic of entity.properties.topics || []) {
      if (!indexes.byTopic.has(topic)) {
        indexes.byTopic.set(topic, []);
      }
      indexes.byTopic.get(topic)!.push(entity);
    }
    
    // Index by country
    for (const country of entity.properties.countries || []) {
      if (!indexes.byCountry.has(country)) {
        indexes.byCountry.set(country, []);
      }
      indexes.byCountry.get(country)!.push(entity);
    }
  }
  
  return indexes;
}
```

### 2. Caching Strategy

```typescript
// Cache screening results for 24 hours
interface ScreeningCache {
  get(key: string): ScreeningResult | null;
  set(key: string, result: ScreeningResult, ttl: number): void;
  invalidate(key: string): void;
  clear(): void;
}

const screeningCache: ScreeningCache = new LRUCache({
  max: 10000, // Cache up to 10k results
  ttl: 86400000 // 24 hours
});

async function screenWithCache(address: string): Promise<ScreeningResult> {
  const cacheKey = `screen:${address}`;
  
  // Check cache first
  const cached = screeningCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Perform screening
  const result = await screenAddress(address);
  
  // Cache result
  screeningCache.set(cacheKey, result, 86400000);
  
  return result;
}
```

### 3. Batch Processing

```typescript
// Process multiple addresses in parallel
async function batchScreen(addresses: string[]): Promise<Map<string, ScreeningResult>> {
  const results = new Map<string, ScreeningResult>();
  
  // Process in chunks of 100
  const chunkSize = 100;
  for (let i = 0; i < addresses.length; i += chunkSize) {
    const chunk = addresses.slice(i, i + chunkSize);
    
    // Parallel processing within chunk
    const chunkResults = await Promise.all(
      chunk.map(addr => screenWithCache(addr))
    );
    
    // Store results
    chunk.forEach((addr, idx) => {
      results.set(addr, chunkResults[idx]);
    });
  }
  
  return results;
}
```

## Configuration

### Dataset Configuration

```json
{
  "opensanctions": {
    "dataPath": "C:\\Users\\raden\\Documents\\Hackathon\\agentic-reserve-system\\dataset\\opensanctions",
    "datasets": {
      "full": "opensanctions-full.jsonl",
      "sanctions": "opensanctions-sanctions.jsonl",
      "persons": "opensanctions-persons.jsonl",
      "companies": "opensanctions-companies.jsonl",
      "crypto": "opensanctions-crypto.jsonl",
      "targets": "opensanctions-targets-only.jsonl",
      "curated": "opensanctions-dataset.jsonl"
    },
    "updateSchedule": {
      "enabled": true,
      "frequency": "daily",
      "time": "00:00 UTC"
    },
    "matching": {
      "fuzzyThreshold": 80,
      "exactMatchBoost": 20,
      "targetBoost": 10,
      "datasetBoost": 5
    },
    "caching": {
      "enabled": true,
      "ttl": 86400,
      "maxSize": 10000
    }
  }
}
```

### Risk Level Thresholds

```json
{
  "riskLevels": {
    "CRITICAL": {
      "minScore": 95,
      "action": "BLOCK",
      "requiresApproval": false,
      "notify": ["compliance-team", "management", "legal"]
    },
    "HIGH": {
      "minScore": 80,
      "action": "FLAG",
      "requiresApproval": true,
      "notify": ["compliance-team"]
    },
    "MEDIUM": {
      "minScore": 60,
      "action": "MONITOR",
      "requiresApproval": false,
      "notify": ["compliance-team"]
    },
    "LOW": {
      "minScore": 0,
      "action": "ALLOW",
      "requiresApproval": false,
      "notify": []
    }
  }
}
```

## Compliance Metrics

### Screening Metrics

- **Total Screenings**: Count of all screening operations
- **Match Rate**: Percentage of screenings with matches
- **False Positive Rate**: Percentage of flagged entities cleared after review
- **Average Screening Time**: Time to complete screening operation
- **Cache Hit Rate**: Percentage of screenings served from cache

### Dataset Metrics

- **Total Entities**: Count of entities in dataset
- **Sanctions Targets**: Count of direct sanctions targets
- **PEPs**: Count of politically exposed persons
- **Crypto Entities**: Count of entities with crypto wallets
- **Last Update**: Timestamp of last dataset update
- **Update Frequency**: Actual vs scheduled update frequency

### Compliance Metrics

- **Blocked Transactions**: Count of transactions blocked due to sanctions
- **Flagged Entities**: Count of entities requiring enhanced due diligence
- **SARs Filed**: Count of Suspicious Activity Reports filed
- **Regulatory Hits**: Count of matches to regulatory lists (OFAC, UN, etc.)

## Integration Example

```typescript
import { OpenSanctionsScreening } from './opensanctions-screening';
import { AMLComplianceAgent } from './aml-compliance-agent';

// Initialize screening service
const screening = new OpenSanctionsScreening({
  dataPath: 'C:\\Users\\raden\\Documents\\Hackathon\\agentic-reserve-system\\dataset\\opensanctions',
  cacheEnabled: true,
  fuzzyThreshold: 80
});

// Initialize AML agent with OpenSanctions integration
const amlAgent = new AMLComplianceAgent({
  screeningService: screening,
  riskThresholds: {
    CRITICAL: 95,
    HIGH: 80,
    MEDIUM: 60,
    LOW: 0
  }
});

// Screen a transaction
async function screenTransaction(tx: Transaction): Promise<void> {
  // Screen sender
  const senderResult = await screening.screenAddress(tx.from);
  
  if (senderResult.riskLevel === 'CRITICAL') {
    throw new Error(`Transaction blocked: Sender ${tx.from} is sanctioned`);
  }
  
  // Screen recipient
  const recipientResult = await screening.screenAddress(tx.to);
  
  if (recipientResult.riskLevel === 'CRITICAL') {
    throw new Error(`Transaction blocked: Recipient ${tx.to} is sanctioned`);
  }
  
  // Check for PEP
  if (senderResult.riskLevel === 'HIGH' || recipientResult.riskLevel === 'HIGH') {
    await amlAgent.flagForEnhancedDueDiligence(tx, {
      senderResult,
      recipientResult
    });
  }
  
  // Log screening result
  await amlAgent.logScreening(tx, {
    senderResult,
    recipientResult,
    timestamp: Date.now()
  });
}
```

## Best Practices

### 1. Regular Updates
- Update datasets daily to ensure current sanctions coverage
- Monitor OpenSanctions changelog for major updates
- Maintain version history for audit purposes

### 2. Fuzzy Matching Tuning
- Adjust fuzzy threshold based on false positive rate
- Review and tune matching algorithm quarterly
- Maintain whitelist for known false positives

### 3. Performance Monitoring
- Track screening latency (target: <100ms p95)
- Monitor cache hit rate (target: >80%)
- Alert on dataset update failures

### 4. Compliance Documentation
- Log all screening decisions
- Maintain audit trail for regulatory examination
- Document false positive resolutions

### 5. Data Privacy
- Minimize PII storage
- Encrypt screening logs
- Implement data retention policies

## Success Metrics

- **Screening Coverage**: 100% of transactions screened
- **Screening Latency**: <100ms p95
- **False Positive Rate**: <5%
- **Dataset Freshness**: <24 hours
- **Regulatory Compliance**: Zero critical findings

---

**Skill Status**: Active  
**Dataset Version**: 2026-02-10  
**Last Update**: 2026-02-10  
**Next Review**: 2026-03-10
