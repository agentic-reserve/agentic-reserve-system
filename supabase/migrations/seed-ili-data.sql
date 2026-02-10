-- Seed ILI History Data
-- Insert sample ILI data for the last 7 days

INSERT INTO ili_history (
  ili_value,
  avg_yield,
  volatility,
  tvl_usd,
  timestamp
) VALUES
  -- Today
  (512.45, 8.5, 12.3, 2500000000, NOW() - INTERVAL '1 hour'),
  (511.80, 8.4, 12.1, 2498000000, NOW() - INTERVAL '2 hours'),
  (510.95, 8.3, 11.9, 2495000000, NOW() - INTERVAL '3 hours'),
  
  -- Yesterday
  (509.20, 8.2, 11.8, 2490000000, NOW() - INTERVAL '1 day'),
  (508.50, 8.1, 11.7, 2488000000, NOW() - INTERVAL '1 day 6 hours'),
  (507.80, 8.0, 11.6, 2485000000, NOW() - INTERVAL '1 day 12 hours'),
  
  -- 2 days ago
  (506.30, 7.9, 11.5, 2480000000, NOW() - INTERVAL '2 days'),
  (505.60, 7.8, 11.4, 2478000000, NOW() - INTERVAL '2 days 6 hours'),
  (504.90, 7.7, 11.3, 2475000000, NOW() - INTERVAL '2 days 12 hours'),
  
  -- 3 days ago
  (503.40, 7.6, 11.2, 2470000000, NOW() - INTERVAL '3 days'),
  (502.70, 7.5, 11.1, 2468000000, NOW() - INTERVAL '3 days 6 hours'),
  (502.00, 7.4, 11.0, 2465000000, NOW() - INTERVAL '3 days 12 hours'),
  
  -- 4 days ago
  (500.50, 7.3, 10.9, 2460000000, NOW() - INTERVAL '4 days'),
  (499.80, 7.2, 10.8, 2458000000, NOW() - INTERVAL '4 days 6 hours'),
  (499.10, 7.1, 10.7, 2455000000, NOW() - INTERVAL '4 days 12 hours'),
  
  -- 5 days ago
  (497.60, 7.0, 10.6, 2450000000, NOW() - INTERVAL '5 days'),
  (496.90, 6.9, 10.5, 2448000000, NOW() - INTERVAL '5 days 6 hours'),
  (496.20, 6.8, 10.4, 2445000000, NOW() - INTERVAL '5 days 12 hours'),
  
  -- 6 days ago
  (494.70, 6.7, 10.3, 2440000000, NOW() - INTERVAL '6 days'),
  (494.00, 6.6, 10.2, 2438000000, NOW() - INTERVAL '6 days 6 hours'),
  (493.30, 6.5, 10.1, 2435000000, NOW() - INTERVAL '6 days 12 hours'),
  
  -- 7 days ago
  (491.80, 6.4, 10.0, 2430000000, NOW() - INTERVAL '7 days'),
  (491.10, 6.3, 9.9, 2428000000, NOW() - INTERVAL '7 days 6 hours'),
  (490.40, 6.2, 9.8, 2425000000, NOW() - INTERVAL '7 days 12 hours');

-- Verify insertion
SELECT 
  COUNT(*) as total_records,
  MIN(timestamp) as earliest,
  MAX(timestamp) as latest,
  AVG(ili_value) as avg_ili,
  MAX(ili_value) as max_ili,
  MIN(ili_value) as min_ili
FROM ili_history;
