-- Run this when moving to PostgreSQL
-- SQLite is handled automatically by SQLAlchemy on startup

CREATE TABLE IF NOT EXISTS games (
    id           SERIAL PRIMARY KEY,
    started_at   TIMESTAMPTZ DEFAULT NOW(),
    ended_at     TIMESTAMPTZ,
    winner_name  TEXT,
    total_rounds INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rounds (
    id               SERIAL PRIMARY KEY,
    game_id          INTEGER REFERENCES games(id) ON DELETE CASCADE,
    round_number     INTEGER NOT NULL,
    winner_name      TEXT NOT NULL,
    pot_size         INTEGER NOT NULL,
    community_cards  JSONB,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS round_actions (
    id          SERIAL PRIMARY KEY,
    round_id    INTEGER REFERENCES rounds(id) ON DELETE CASCADE,
    agent_name  TEXT NOT NULL,
    action      TEXT NOT NULL,
    amount      INTEGER DEFAULT 0,
    thought     TEXT,
    hole_cards  JSONB,
    hand_rank   TEXT
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_rounds_game_id      ON rounds(game_id);
CREATE INDEX IF NOT EXISTS idx_actions_round_id    ON round_actions(round_id);
CREATE INDEX IF NOT EXISTS idx_actions_agent_name  ON round_actions(agent_name);
CREATE INDEX IF NOT EXISTS idx_rounds_winner       ON rounds(winner_name);