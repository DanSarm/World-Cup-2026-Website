-- Tournament Picks: market-based dynamic points.
-- Adds pre-tournament market win % to teams and a per-place points
-- breakdown to tournament podium predictions.

ALTER TABLE teams ADD COLUMN IF NOT EXISTS market_win_percentage numeric;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS market_rank int;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS market_label text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS tournament_value_override int;

ALTER TABLE tournament_podium_predictions ADD COLUMN IF NOT EXISTS champion_points int NOT NULL DEFAULT 0;
ALTER TABLE tournament_podium_predictions ADD COLUMN IF NOT EXISTS runner_up_points int NOT NULL DEFAULT 0;
ALTER TABLE tournament_podium_predictions ADD COLUMN IF NOT EXISTS third_place_points int NOT NULL DEFAULT 0;

-- ── Seed: pre-tournament market win percentages ──
-- Ranks 1-17 from the market. Teams below are estimates by rank band:
--   ranks 18-24 → 0.8 · ranks 25-32 → 0.5 · ranks 33-48 → 0.4
-- Admin can refine via the market CSV import.

UPDATE teams SET market_rank = 1,  market_win_percentage = 15,  market_label = NULL  WHERE fifa_code = 'ESP';
UPDATE teams SET market_rank = 2,  market_win_percentage = 14,  market_label = NULL  WHERE fifa_code = 'FRA';
UPDATE teams SET market_rank = 3,  market_win_percentage = 10,  market_label = NULL  WHERE fifa_code = 'ENG';
UPDATE teams SET market_rank = 4,  market_win_percentage = 8.9, market_label = NULL  WHERE fifa_code = 'POR';
UPDATE teams SET market_rank = 5,  market_win_percentage = 8.3, market_label = NULL  WHERE fifa_code = 'BRA';
UPDATE teams SET market_rank = 6,  market_win_percentage = 8.3, market_label = NULL  WHERE fifa_code = 'ARG';
UPDATE teams SET market_rank = 7,  market_win_percentage = 5.9, market_label = NULL  WHERE fifa_code = 'GER';
UPDATE teams SET market_rank = 8,  market_win_percentage = 4.1, market_label = NULL  WHERE fifa_code = 'NED';
UPDATE teams SET market_rank = 9,  market_win_percentage = 2.9, market_label = NULL  WHERE fifa_code = 'NOR';
UPDATE teams SET market_rank = 10, market_win_percentage = 2.2, market_label = NULL  WHERE fifa_code = 'BEL';
UPDATE teams SET market_rank = 11, market_win_percentage = 2.2, market_label = NULL  WHERE fifa_code = 'COL';
UPDATE teams SET market_rank = 12, market_win_percentage = 1.6, market_label = NULL  WHERE fifa_code = 'MAR';
UPDATE teams SET market_rank = 13, market_win_percentage = 1.5, market_label = NULL  WHERE fifa_code = 'JPN';
UPDATE teams SET market_rank = 14, market_win_percentage = 1.5, market_label = NULL  WHERE fifa_code = 'USA';
UPDATE teams SET market_rank = 15, market_win_percentage = 1.2, market_label = NULL  WHERE fifa_code = 'MEX';
UPDATE teams SET market_rank = 16, market_win_percentage = 1.2, market_label = NULL  WHERE fifa_code = 'SUI';
UPDATE teams SET market_rank = 17, market_win_percentage = 1.1, market_label = NULL  WHERE fifa_code = 'URU';

-- Ranks 18-24 (estimated 0.8%)
UPDATE teams SET market_rank = 18, market_win_percentage = 0.8, market_label = '<1%' WHERE fifa_code = 'CRO';
UPDATE teams SET market_rank = 19, market_win_percentage = 0.8, market_label = '<1%' WHERE fifa_code = 'CAN';
UPDATE teams SET market_rank = 20, market_win_percentage = 0.8, market_label = '<1%' WHERE fifa_code = 'SEN';
UPDATE teams SET market_rank = 21, market_win_percentage = 0.8, market_label = '<1%' WHERE fifa_code = 'ECU';
UPDATE teams SET market_rank = 22, market_win_percentage = 0.8, market_label = '<1%' WHERE fifa_code = 'TUR';
UPDATE teams SET market_rank = 23, market_win_percentage = 0.8, market_label = '<1%' WHERE fifa_code = 'AUT';
UPDATE teams SET market_rank = 24, market_win_percentage = 0.8, market_label = '<1%' WHERE fifa_code = 'KOR';

-- Ranks 25-32 (estimated 0.5%)
UPDATE teams SET market_rank = 25, market_win_percentage = 0.5, market_label = '<1%' WHERE fifa_code = 'SWE';
UPDATE teams SET market_rank = 26, market_win_percentage = 0.5, market_label = '<1%' WHERE fifa_code = 'EGY';
UPDATE teams SET market_rank = 27, market_win_percentage = 0.5, market_label = '<1%' WHERE fifa_code = 'ALG';
UPDATE teams SET market_rank = 28, market_win_percentage = 0.5, market_label = '<1%' WHERE fifa_code = 'AUS';
UPDATE teams SET market_rank = 29, market_win_percentage = 0.5, market_label = '<1%' WHERE fifa_code = 'PAR';
UPDATE teams SET market_rank = 30, market_win_percentage = 0.5, market_label = '<1%' WHERE fifa_code = 'SCO';
UPDATE teams SET market_rank = 31, market_win_percentage = 0.5, market_label = '<1%' WHERE fifa_code = 'IRN';
UPDATE teams SET market_rank = 32, market_win_percentage = 0.5, market_label = '<1%' WHERE fifa_code = 'TUN';

-- Ranks 33-48 (estimated 0.4%)
UPDATE teams SET market_rank = 33, market_win_percentage = 0.4, market_label = '<1%' WHERE fifa_code = 'RSA';
UPDATE teams SET market_rank = 34, market_win_percentage = 0.4, market_label = '<1%' WHERE fifa_code = 'CZE';
UPDATE teams SET market_rank = 35, market_win_percentage = 0.4, market_label = '<1%' WHERE fifa_code = 'BIH';
UPDATE teams SET market_rank = 36, market_win_percentage = 0.4, market_label = '<1%' WHERE fifa_code = 'QAT';
UPDATE teams SET market_rank = 37, market_win_percentage = 0.4, market_label = '<1%' WHERE fifa_code = 'HAI';
UPDATE teams SET market_rank = 38, market_win_percentage = 0.4, market_label = '<1%' WHERE fifa_code = 'CIV';
UPDATE teams SET market_rank = 39, market_win_percentage = 0.4, market_label = '<1%' WHERE fifa_code = 'CUW';
UPDATE teams SET market_rank = 40, market_win_percentage = 0.4, market_label = '<1%' WHERE fifa_code = 'NZL';
UPDATE teams SET market_rank = 41, market_win_percentage = 0.4, market_label = '<1%' WHERE fifa_code = 'CPV';
UPDATE teams SET market_rank = 42, market_win_percentage = 0.4, market_label = '<1%' WHERE fifa_code = 'KSA';
UPDATE teams SET market_rank = 43, market_win_percentage = 0.4, market_label = '<1%' WHERE fifa_code = 'IRQ';
UPDATE teams SET market_rank = 44, market_win_percentage = 0.4, market_label = '<1%' WHERE fifa_code = 'JOR';
UPDATE teams SET market_rank = 45, market_win_percentage = 0.4, market_label = '<1%' WHERE fifa_code = 'UZB';
UPDATE teams SET market_rank = 46, market_win_percentage = 0.4, market_label = '<1%' WHERE fifa_code = 'COD';
UPDATE teams SET market_rank = 47, market_win_percentage = 0.4, market_label = '<1%' WHERE fifa_code = 'GHA';
UPDATE teams SET market_rank = 48, market_win_percentage = 0.4, market_label = '<1%' WHERE fifa_code = 'PAN';
