-- Fix kickoff times for all 104 matches.
-- Previously every match was seeded with a placeholder 18:00 UTC (2 PM ET).
-- These are the official FIFA kickoff times, stored in UTC (ET schedule, EDT = UTC-4).
-- Safe: only updates matches.kickoff_at — no picks, scores, or predictions are touched.

UPDATE matches AS m
SET kickoff_at = v.kickoff_at::timestamptz
FROM (
  VALUES
    -- Group stage
    (1,   '2026-06-11T19:00:00Z'), -- Mexico v South Africa · 3:00 PM ET
    (2,   '2026-06-12T02:00:00Z'), -- Korea Republic v Czechia · 10:00 PM ET
    (3,   '2026-06-12T19:00:00Z'), -- Canada v Bosnia · 3:00 PM ET
    (4,   '2026-06-13T01:00:00Z'), -- USA v Paraguay · 9:00 PM ET
    (5,   '2026-06-14T01:00:00Z'), -- Haiti v Scotland · 9:00 PM ET
    (6,   '2026-06-14T04:00:00Z'), -- Australia v Türkiye · 12:00 AM ET (Jun 14)
    (7,   '2026-06-13T22:00:00Z'), -- Brazil v Morocco · 6:00 PM ET
    (8,   '2026-06-13T19:00:00Z'), -- Qatar v Switzerland · 3:00 PM ET
    (9,   '2026-06-14T23:00:00Z'), -- Côte d'Ivoire v Ecuador · 7:00 PM ET
    (10,  '2026-06-14T17:00:00Z'), -- Germany v Curaçao · 1:00 PM ET
    (11,  '2026-06-14T20:00:00Z'), -- Netherlands v Japan · 4:00 PM ET
    (12,  '2026-06-15T02:00:00Z'), -- Sweden v Tunisia · 10:00 PM ET
    (13,  '2026-06-15T22:00:00Z'), -- Saudi Arabia v Uruguay · 6:00 PM ET
    (14,  '2026-06-15T16:00:00Z'), -- Spain v Cabo Verde · 12:00 PM ET
    (15,  '2026-06-16T01:00:00Z'), -- IR Iran v New Zealand · 9:00 PM ET
    (16,  '2026-06-15T19:00:00Z'), -- Belgium v Egypt · 3:00 PM ET
    (17,  '2026-06-16T19:00:00Z'), -- France v Senegal · 3:00 PM ET
    (18,  '2026-06-16T22:00:00Z'), -- Iraq v Norway · 6:00 PM ET
    (19,  '2026-06-17T01:00:00Z'), -- Argentina v Algeria · 9:00 PM ET
    (20,  '2026-06-17T04:00:00Z'), -- Austria v Jordan · 12:00 AM ET (Jun 17)
    (21,  '2026-06-17T23:00:00Z'), -- Ghana v Panama · 7:00 PM ET
    (22,  '2026-06-17T20:00:00Z'), -- England v Croatia · 4:00 PM ET
    (23,  '2026-06-17T17:00:00Z'), -- Portugal v Congo DR · 1:00 PM ET
    (24,  '2026-06-18T02:00:00Z'), -- Uzbekistan v Colombia · 10:00 PM ET
    (25,  '2026-06-18T16:00:00Z'), -- Czechia v South Africa · 12:00 PM ET
    (26,  '2026-06-18T19:00:00Z'), -- Switzerland v Bosnia · 3:00 PM ET
    (27,  '2026-06-18T22:00:00Z'), -- Canada v Qatar · 6:00 PM ET
    (28,  '2026-06-19T01:00:00Z'), -- Mexico v Korea Republic · 9:00 PM ET
    (29,  '2026-06-20T01:00:00Z'), -- Brazil v Haiti · 9:00 PM ET
    (30,  '2026-06-19T22:00:00Z'), -- Scotland v Morocco · 6:00 PM ET
    (31,  '2026-06-20T03:00:00Z'), -- Türkiye v Paraguay · 11:00 PM ET
    (32,  '2026-06-19T19:00:00Z'), -- USA v Australia · 3:00 PM ET
    (33,  '2026-06-20T20:00:00Z'), -- Germany v Côte d'Ivoire · 4:00 PM ET
    (34,  '2026-06-21T00:00:00Z'), -- Ecuador v Curaçao · 8:00 PM ET
    (35,  '2026-06-20T17:00:00Z'), -- Netherlands v Sweden · 1:00 PM ET
    (36,  '2026-06-21T04:00:00Z'), -- Tunisia v Japan · 12:00 AM ET (Jun 21)
    (37,  '2026-06-21T22:00:00Z'), -- Uruguay v Cabo Verde · 6:00 PM ET
    (38,  '2026-06-21T16:00:00Z'), -- Spain v Saudi Arabia · 12:00 PM ET
    (39,  '2026-06-21T19:00:00Z'), -- Belgium v IR Iran · 3:00 PM ET
    (40,  '2026-06-22T01:00:00Z'), -- New Zealand v Egypt · 9:00 PM ET
    (41,  '2026-06-23T00:00:00Z'), -- Norway v Senegal · 8:00 PM ET
    (42,  '2026-06-22T21:00:00Z'), -- France v Iraq · 5:00 PM ET
    (43,  '2026-06-22T17:00:00Z'), -- Argentina v Austria · 1:00 PM ET
    (44,  '2026-06-23T03:00:00Z'), -- Jordan v Algeria · 11:00 PM ET
    (45,  '2026-06-23T20:00:00Z'), -- England v Ghana · 4:00 PM ET
    (46,  '2026-06-23T23:00:00Z'), -- Panama v Croatia · 7:00 PM ET
    (47,  '2026-06-23T17:00:00Z'), -- Portugal v Uzbekistan · 1:00 PM ET
    (48,  '2026-06-24T02:00:00Z'), -- Colombia v Congo DR · 10:00 PM ET
    (49,  '2026-06-24T22:00:00Z'), -- Scotland v Brazil · 6:00 PM ET
    (50,  '2026-06-24T22:00:00Z'), -- Morocco v Haiti · 6:00 PM ET
    (51,  '2026-06-24T19:00:00Z'), -- Switzerland v Canada · 3:00 PM ET
    (52,  '2026-06-24T19:00:00Z'), -- Bosnia v Qatar · 3:00 PM ET
    (53,  '2026-06-25T01:00:00Z'), -- Czechia v Mexico · 9:00 PM ET
    (54,  '2026-06-25T01:00:00Z'), -- South Africa v Korea Republic · 9:00 PM ET
    (55,  '2026-06-25T20:00:00Z'), -- Curaçao v Côte d'Ivoire · 4:00 PM ET
    (56,  '2026-06-25T20:00:00Z'), -- Ecuador v Germany · 4:00 PM ET
    (57,  '2026-06-25T23:00:00Z'), -- Japan v Sweden · 7:00 PM ET
    (58,  '2026-06-25T23:00:00Z'), -- Tunisia v Netherlands · 7:00 PM ET
    (59,  '2026-06-26T02:00:00Z'), -- Türkiye v USA · 10:00 PM ET
    (60,  '2026-06-26T02:00:00Z'), -- Paraguay v Australia · 10:00 PM ET
    (61,  '2026-06-26T19:00:00Z'), -- Norway v France · 3:00 PM ET
    (62,  '2026-06-26T19:00:00Z'), -- Senegal v Iraq · 3:00 PM ET
    (63,  '2026-06-27T03:00:00Z'), -- Egypt v IR Iran · 11:00 PM ET
    (64,  '2026-06-27T03:00:00Z'), -- New Zealand v Belgium · 11:00 PM ET
    (65,  '2026-06-27T00:00:00Z'), -- Cabo Verde v Saudi Arabia · 8:00 PM ET
    (66,  '2026-06-27T00:00:00Z'), -- Uruguay v Spain · 8:00 PM ET
    (67,  '2026-06-27T21:00:00Z'), -- Panama v England · 5:00 PM ET
    (68,  '2026-06-27T21:00:00Z'), -- Croatia v Ghana · 5:00 PM ET
    (69,  '2026-06-28T02:00:00Z'), -- Algeria v Austria · 10:00 PM ET
    (70,  '2026-06-28T02:00:00Z'), -- Jordan v Argentina · 10:00 PM ET
    (71,  '2026-06-27T23:30:00Z'), -- Colombia v Portugal · 7:30 PM ET
    (72,  '2026-06-27T23:30:00Z'), -- Congo DR v Uzbekistan · 7:30 PM ET
    -- Round of 32
    (73,  '2026-06-28T19:00:00Z'), -- 3:00 PM ET
    (74,  '2026-06-29T20:30:00Z'), -- 4:30 PM ET
    (75,  '2026-06-30T01:00:00Z'), -- 9:00 PM ET
    (76,  '2026-06-29T17:00:00Z'), -- 1:00 PM ET
    (77,  '2026-06-30T21:00:00Z'), -- 5:00 PM ET
    (78,  '2026-06-30T17:00:00Z'), -- 1:00 PM ET
    (79,  '2026-07-01T01:00:00Z'), -- 9:00 PM ET
    (80,  '2026-07-01T16:00:00Z'), -- 12:00 PM ET
    (81,  '2026-07-02T00:00:00Z'), -- 8:00 PM ET
    (82,  '2026-07-01T20:00:00Z'), -- 4:00 PM ET
    (83,  '2026-07-02T23:00:00Z'), -- 7:00 PM ET
    (84,  '2026-07-02T19:00:00Z'), -- 3:00 PM ET
    (85,  '2026-07-03T03:00:00Z'), -- 11:00 PM ET
    (86,  '2026-07-03T22:00:00Z'), -- 6:00 PM ET
    (87,  '2026-07-04T01:30:00Z'), -- 9:30 PM ET
    (88,  '2026-07-03T18:00:00Z'), -- 2:00 PM ET
    -- Round of 16
    (89,  '2026-07-04T21:00:00Z'), -- 5:00 PM ET
    (90,  '2026-07-04T17:00:00Z'), -- 1:00 PM ET
    (91,  '2026-07-05T20:00:00Z'), -- 4:00 PM ET
    (92,  '2026-07-06T00:00:00Z'), -- 8:00 PM ET
    (93,  '2026-07-06T19:00:00Z'), -- 3:00 PM ET
    (94,  '2026-07-07T00:00:00Z'), -- 8:00 PM ET
    (95,  '2026-07-07T16:00:00Z'), -- 12:00 PM ET
    (96,  '2026-07-07T20:00:00Z'), -- 4:00 PM ET
    -- Quarterfinals
    (97,  '2026-07-09T20:00:00Z'), -- 4:00 PM ET
    (98,  '2026-07-10T19:00:00Z'), -- 3:00 PM ET
    (99,  '2026-07-11T21:00:00Z'), -- 5:00 PM ET
    (100, '2026-07-12T01:00:00Z'), -- 9:00 PM ET
    -- Semifinals
    (101, '2026-07-14T19:00:00Z'), -- 3:00 PM ET
    (102, '2026-07-15T19:00:00Z'), -- 3:00 PM ET
    -- Third place
    (103, '2026-07-18T21:00:00Z'), -- 5:00 PM ET
    -- Final
    (104, '2026-07-19T19:00:00Z')  -- 3:00 PM ET
) AS v(match_number, kickoff_at)
WHERE m.match_number = v.match_number;
