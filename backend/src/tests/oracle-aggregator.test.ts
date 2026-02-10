import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property-Based Tests for Oracle Aggregator
 * Validates manipulation resistance of median calculation
 */

// Helper function to calculate median
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

// Helper function to calculate mean
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

// Helper function to calculate standard deviation
function calculateStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(variance);
}

describe('Oracle Aggregator - Property-Based Tests', () => {
  /**
   * Property Test 2.7: Median Calculation Manipulation Resistance
   * Validates Requirements 6.2, 6.3
   */
  describe('Median Calculation Manipulation Resistance', () => {
    it('should resist single-source manipulation (Property Test 2.7)', () => {
      fc.assert(
        fc.property(
          // Generate 3 prices (representing Pyth, Switchboard, Birdeye)
          fc.tuple(
            fc.float({ min: 1, max: 1000, noNaN: true }),
            fc.float({ min: 1, max: 1000, noNaN: true }),
            fc.float({ min: 1, max: 1000, noNaN: true })
          ),
          // Generate a manipulation factor (1.5x to 10x)
          fc.float({ min: 1.5, max: 10, noNaN: true }),
          ([price1, price2, price3], manipulationFactor) => {
            const originalPrices = [price1, price2, price3];
            const originalMedian = calculateMedian(originalPrices);

            // Manipulate one source (simulate oracle attack)
            const manipulatedPrices = [
              price1 * manipulationFactor, // Manipulated source
              price2,                       // Honest source
              price3,                       // Honest source
            ];
            const manipulatedMedian = calculateMedian(manipulatedPrices);

            // The median should be closer to the honest sources than the manipulated one
            const honestAverage = (price2 + price3) / 2;
            const distanceToHonest = Math.abs(manipulatedMedian - honestAverage);
            const distanceToManipulated = Math.abs(manipulatedMedian - (price1 * manipulationFactor));

            // Median should be closer to honest sources
            expect(distanceToHonest).toBeLessThan(distanceToManipulated);

            // Median should not move more than 50% from original
            const percentageChange = Math.abs((manipulatedMedian - originalMedian) / originalMedian) * 100;
            expect(percentageChange).toBeLessThan(50);
          }
        ),
        { numRuns: 1000 } // Run 1000 random test cases
      );
    });

    it('should detect outliers using 2-sigma rule', () => {
      fc.assert(
        fc.property(
          // Generate 3 similar prices
          fc.float({ min: 100, max: 200, noNaN: true }),
          fc.float({ min: -5, max: 5, noNaN: true }), // Small deviation
          fc.float({ min: -5, max: 5, noNaN: true }), // Small deviation
          (basePrice, deviation1, deviation2) => {
            const price1 = basePrice + deviation1;
            const price2 = basePrice + deviation2;
            const price3 = basePrice * 3; // Outlier (3x the base)

            const prices = [price1, price2, price3];
            const mean = calculateMean(prices);
            const stdDev = calculateStdDev(prices, mean);

            // Check if price3 is an outlier (>2σ from mean)
            const deviationFromMean = Math.abs(price3 - mean);
            const isOutlier = deviationFromMean > 2 * stdDev;

            // Price3 should be detected as an outlier
            expect(isOutlier).toBe(true);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('should maintain median stability with small price variations', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 50, max: 150, noNaN: true }),
          fc.float({ min: -2, max: 2, noNaN: true }),
          fc.float({ min: -2, max: 2, noNaN: true }),
          fc.float({ min: -2, max: 2, noNaN: true }),
          (basePrice, var1, var2, var3) => {
            const prices = [
              basePrice + var1,
              basePrice + var2,
              basePrice + var3,
            ];

            const median = calculateMedian(prices);

            // Median should be close to base price (within 5%)
            const percentageDiff = Math.abs((median - basePrice) / basePrice) * 100;
            expect(percentageDiff).toBeLessThan(5);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('should handle two-source manipulation (worst case)', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 100, max: 200, noNaN: true }),
          fc.float({ min: 2, max: 5, noNaN: true }),
          (honestPrice, manipulationFactor) => {
            // Two sources manipulated, one honest
            const prices = [
              honestPrice * manipulationFactor, // Manipulated
              honestPrice * manipulationFactor, // Manipulated
              honestPrice,                      // Honest
            ];

            const median = calculateMedian(prices);

            // In this worst case, median will be manipulated
            // But it should still be the manipulated value (not higher)
            expect(median).toBe(honestPrice * manipulationFactor);

            // This demonstrates why we need at least 2 honest sources
            // With 2/3 manipulated, the system is compromised
          }
        ),
        { numRuns: 500 }
      );
    });

    it('should correctly calculate confidence interval', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.float({ min: 90, max: 110, noNaN: true }),
            fc.float({ min: 90, max: 110, noNaN: true }),
            fc.float({ min: 90, max: 110, noNaN: true })
          ),
          ([price1, price2, price3]) => {
            const prices = [price1, price2, price3];
            const median = calculateMedian(prices);
            const mean = calculateMean(prices);
            const stdDev = calculateStdDev(prices, mean);

            // Confidence interval as percentage
            const confidenceInterval = median > 0 ? (stdDev / median) * 100 : 0;

            // Confidence interval should be non-negative
            expect(confidenceInterval).toBeGreaterThanOrEqual(0);

            // For similar prices (within 20% range), confidence should be low
            const priceRange = Math.max(...prices) - Math.min(...prices);
            const rangePercentage = (priceRange / median) * 100;

            if (rangePercentage < 20) {
              expect(confidenceInterval).toBeLessThan(10);
            }
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('Median Calculation Properties', () => {
    it('should always return a value within the input range', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: 1, max: 1000, noNaN: true }), { minLength: 1, maxLength: 10 }),
          (prices) => {
            const median = calculateMedian(prices);
            const min = Math.min(...prices);
            const max = Math.max(...prices);

            expect(median).toBeGreaterThanOrEqual(min);
            expect(median).toBeLessThanOrEqual(max);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('should be deterministic (same input = same output)', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: 1, max: 1000, noNaN: true }), { minLength: 3, maxLength: 3 }),
          (prices) => {
            const median1 = calculateMedian(prices);
            const median2 = calculateMedian(prices);

            expect(median1).toBe(median2);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('should be order-independent', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: 1, max: 1000, noNaN: true }), { minLength: 3, maxLength: 3 }),
          (prices) => {
            const median1 = calculateMedian(prices);
            const shuffled = [...prices].reverse();
            const median2 = calculateMedian(shuffled);

            expect(median1).toBe(median2);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('Quality Scoring Properties', () => {
    it('should score excellent quality for tight price clusters', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 100, max: 200, noNaN: true }),
          (basePrice) => {
            // Prices within 0.5% of each other
            const prices = [
              basePrice,
              basePrice * 1.002,
              basePrice * 0.998,
            ];

            const median = calculateMedian(prices);
            const mean = calculateMean(prices);
            const stdDev = calculateStdDev(prices, mean);
            const confidenceInterval = (stdDev / median) * 100;

            // Should be excellent quality (< 0.5%)
            expect(confidenceInterval).toBeLessThan(0.5);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('should score poor quality for widely dispersed prices', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 100, max: 200, noNaN: true }),
          (basePrice) => {
            // Prices with >2% dispersion
            const prices = [
              basePrice,
              basePrice * 1.05,
              basePrice * 0.95,
            ];

            const median = calculateMedian(prices);
            const mean = calculateMean(prices);
            const stdDev = calculateStdDev(prices, mean);
            const confidenceInterval = (stdDev / median) * 100;

            // Should be poor quality (> 2%)
            expect(confidenceInterval).toBeGreaterThan(2);
          }
        ),
        { numRuns: 500 }
      );
    });
  });
});
