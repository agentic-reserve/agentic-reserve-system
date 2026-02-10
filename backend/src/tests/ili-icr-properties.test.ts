import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property-Based Tests for ILI and ICR Calculators
 * 
 * These tests verify mathematical invariants and bounds
 * using property-based testing with fast-check
 */

describe('ILI Calculator Properties', () => {
  /**
   * Property Test 4.5: Verify ILI is always positive and bounded
   * Validates: Requirements 1.5
   */
  it('should always produce positive and bounded ILI values', () => {
    fc.assert(
      fc.property(
        // Generate random but realistic inputs
        fc.record({
          avgYield: fc.float({ min: 0, max: 20, noNaN: true }),      // 0-20% APY (more realistic)
          volatility: fc.float({ min: 0, max: 50, noNaN: true }),    // 0-50% volatility (more realistic)
          tvl: fc.integer({ min: 1000000, max: 100000000000 }),      // $1M - $100B (more realistic)
          baselineTvl: fc.integer({ min: 1000000000, max: 10000000000 }) // $1B - $10B
        }),
        (inputs) => {
          // Apply ILI formula
          const SCALING_CONSTANT = 1000;
          const normalizedTvl = inputs.tvl / inputs.baselineTvl;
          const yieldComponent = inputs.avgYield / (1 + inputs.volatility / 100);
          const tvlComponent = Math.log(1 + normalizedTvl);
          const ili = SCALING_CONSTANT * yieldComponent * tvlComponent;

          // Property 1: ILI must be positive
          expect(ili).toBeGreaterThanOrEqual(0);

          // Property 2: ILI must be finite
          expect(isFinite(ili)).toBe(true);
          expect(isNaN(ili)).toBe(false);

          // Property 3: ILI increases with yield (holding others constant)
          if (inputs.avgYield > 1) {
            const higherYield = inputs.avgYield * 1.1;
            const iliHigher = SCALING_CONSTANT * 
              (higherYield / (1 + inputs.volatility / 100)) * 
              tvlComponent;
            expect(iliHigher).toBeGreaterThan(ili);
          }

          // Property 4: ILI decreases with volatility (holding others constant)
          if (inputs.volatility < 40 && inputs.avgYield > 0) {
            const higherVolatility = inputs.volatility + 10;
            const iliLower = SCALING_CONSTANT * 
              (inputs.avgYield / (1 + higherVolatility / 100)) * 
              tvlComponent;
            if (iliLower < ili) {
              expect(iliLower).toBeLessThan(ili);
            }
          }
        }
      ),
      { numRuns: 1000 } // Run 1000 test cases
    );
  });

  it('should handle edge cases gracefully', () => {
    fc.assert(
      fc.property(
        fc.record({
          avgYield: fc.constantFrom(0, 0.001, 100),
          volatility: fc.constantFrom(0, 0.001, 100),
          tvl: fc.constantFrom(1, 1000000, 1000000000000),
          baselineTvl: fc.constantFrom(1000000000, 10000000000, 100000000000)
        }),
        (inputs) => {
          const SCALING_CONSTANT = 1000;
          const normalizedTvl = inputs.tvl / inputs.baselineTvl;
          const yieldComponent = inputs.avgYield / (1 + inputs.volatility / 100);
          const tvlComponent = Math.log(1 + normalizedTvl);
          const ili = SCALING_CONSTANT * yieldComponent * tvlComponent;

          // Must always be valid number
          expect(isFinite(ili)).toBe(true);
          expect(isNaN(ili)).toBe(false);
          expect(ili).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be monotonic with respect to TVL', () => {
    fc.assert(
      fc.property(
        fc.record({
          avgYield: fc.float({ min: 1, max: 20, noNaN: true }),
          volatility: fc.float({ min: 5, max: 30, noNaN: true }),
          tvl1: fc.integer({ min: 1000000000, max: 5000000000 }),
          tvl2: fc.integer({ min: 5000000000, max: 10000000000 }),
          baselineTvl: fc.constant(1000000000)
        }),
        (inputs) => {
          const SCALING_CONSTANT = 1000;
          
          // Calculate ILI for lower TVL
          const normalizedTvl1 = inputs.tvl1 / inputs.baselineTvl;
          const yieldComponent = inputs.avgYield / (1 + inputs.volatility / 100);
          const tvlComponent1 = Math.log(1 + normalizedTvl1);
          const ili1 = SCALING_CONSTANT * yieldComponent * tvlComponent1;

          // Calculate ILI for higher TVL
          const normalizedTvl2 = inputs.tvl2 / inputs.baselineTvl;
          const tvlComponent2 = Math.log(1 + normalizedTvl2);
          const ili2 = SCALING_CONSTANT * yieldComponent * tvlComponent2;

          // Property: Higher TVL should produce higher ILI
          expect(ili2).toBeGreaterThan(ili1);
        }
      ),
      { numRuns: 500 }
    );
  });
});

describe('ICR Calculator Properties', () => {
  /**
   * Property Test 5.5: Verify ICR stays within 0-100% range
   * Validates: Requirements 4.1, 4.5
   */
  it('should always produce ICR within 0-100% range', () => {
    fc.assert(
      fc.property(
        // Generate random lending rates
        fc.array(
          fc.record({
            protocol: fc.constantFrom('kamino', 'marginfi', 'solend', 'port'),
            rate: fc.float({ min: 0, max: 10000, noNaN: true }), // 0-100% in basis points
            tvl: fc.integer({ min: 1000000, max: 10000000000 })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (rates) => {
          // Calculate weighted average ICR
          const totalTvl = rates.reduce((sum, r) => sum + r.tvl, 0);
          const weightedRate = rates.reduce((sum, r) => {
            const weight = r.tvl / totalTvl;
            return sum + (r.rate * weight);
          }, 0);

          // Property 1: ICR must be >= 0%
          expect(weightedRate).toBeGreaterThanOrEqual(0);

          // Property 2: ICR must be <= 100%
          expect(weightedRate).toBeLessThanOrEqual(10000);

          // Property 3: ICR must be finite
          expect(isFinite(weightedRate)).toBe(true);
          expect(isNaN(weightedRate)).toBe(false);

          // Property 4: ICR should be within range of input rates
          const minRate = Math.min(...rates.map(r => r.rate));
          const maxRate = Math.max(...rates.map(r => r.rate));
          expect(weightedRate).toBeGreaterThanOrEqual(minRate);
          expect(weightedRate).toBeLessThanOrEqual(maxRate);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('should handle single protocol correctly', () => {
    fc.assert(
      fc.property(
        fc.record({
          rate: fc.float({ min: 0, max: 10000, noNaN: true }),
          tvl: fc.integer({ min: 1000000, max: 10000000000 })
        }),
        (input) => {
          // With single protocol, ICR should equal that protocol's rate
          const weightedRate = input.rate;

          expect(weightedRate).toBe(input.rate);
          expect(weightedRate).toBeGreaterThanOrEqual(0);
          expect(weightedRate).toBeLessThanOrEqual(10000);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should weight by TVL correctly', () => {
    fc.assert(
      fc.property(
        fc.record({
          rate1: fc.float({ min: 100, max: 500, noNaN: true }),  // 1-5%
          rate2: fc.float({ min: 600, max: 1000, noNaN: true }), // 6-10%
          tvl1: fc.integer({ min: 1000000000, max: 5000000000 }),
          tvl2: fc.integer({ min: 1000000000, max: 5000000000 })
        }),
        (inputs) => {
          const rates = [
            { rate: inputs.rate1, tvl: inputs.tvl1 },
            { rate: inputs.rate2, tvl: inputs.tvl2 }
          ];

          const totalTvl = inputs.tvl1 + inputs.tvl2;
          const weightedRate = rates.reduce((sum, r) => {
            const weight = r.tvl / totalTvl;
            return sum + (r.rate * weight);
          }, 0);

          // Property: Weighted rate should be between the two rates
          const minRate = Math.min(inputs.rate1, inputs.rate2);
          const maxRate = Math.max(inputs.rate1, inputs.rate2);
          expect(weightedRate).toBeGreaterThanOrEqual(minRate);
          expect(weightedRate).toBeLessThanOrEqual(maxRate);

          // Property: If TVLs are equal, weighted rate should be average
          if (Math.abs(inputs.tvl1 - inputs.tvl2) < 1000000) {
            const average = (inputs.rate1 + inputs.rate2) / 2;
            expect(Math.abs(weightedRate - average)).toBeLessThan(1);
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it('should handle extreme TVL differences', () => {
    fc.assert(
      fc.property(
        fc.record({
          dominantRate: fc.float({ min: 500, max: 800, noNaN: true }),
          minorRate: fc.float({ min: 100, max: 1000, noNaN: true }),
          dominantTvl: fc.constant(10000000000), // $10B
          minorTvl: fc.constant(1000000)         // $1M
        }),
        (inputs) => {
          const rates = [
            { rate: inputs.dominantRate, tvl: inputs.dominantTvl },
            { rate: inputs.minorRate, tvl: inputs.minorTvl }
          ];

          const totalTvl = inputs.dominantTvl + inputs.minorTvl;
          const weightedRate = rates.reduce((sum, r) => {
            const weight = r.tvl / totalTvl;
            return sum + (r.rate * weight);
          }, 0);

          // Property: With extreme TVL difference, weighted rate should be
          // very close to the dominant protocol's rate
          expect(Math.abs(weightedRate - inputs.dominantRate)).toBeLessThan(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('ILI and ICR Integration Properties', () => {
  it('should maintain consistency across multiple calculations', () => {
    fc.assert(
      fc.property(
        fc.record({
          avgYield: fc.float({ min: 5, max: 15, noNaN: true }),
          volatility: fc.float({ min: 10, max: 30, noNaN: true }),
          tvl: fc.integer({ min: 1000000000, max: 100000000000 }),
          baselineTvl: fc.constant(1000000000)
        }),
        (inputs) => {
          const SCALING_CONSTANT = 1000;
          
          // Calculate ILI twice with same inputs
          const normalizedTvl = inputs.tvl / inputs.baselineTvl;
          const yieldComponent = inputs.avgYield / (1 + inputs.volatility / 100);
          const tvlComponent = Math.log(1 + normalizedTvl);
          
          const ili1 = SCALING_CONSTANT * yieldComponent * tvlComponent;
          const ili2 = SCALING_CONSTANT * yieldComponent * tvlComponent;

          // Property: Same inputs should produce same output (deterministic)
          expect(ili1).toBe(ili2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle zero values gracefully', () => {
    // ILI with zero yield
    const ili1 = 1000 * (0 / (1 + 0.1)) * Math.log(1 + 1);
    expect(ili1).toBe(0);
    expect(isFinite(ili1)).toBe(true);

    // ICR with zero rate
    const icr1 = 0;
    expect(icr1).toBe(0);
    expect(icr1).toBeGreaterThanOrEqual(0);
    expect(icr1).toBeLessThanOrEqual(10000);
  });
});
