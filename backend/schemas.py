from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# ── Game ──────────────────────────────────────────────────────────────────────

class GameCreate(BaseModel):
    pass  # nothing needed to start a game

class GameEnd(BaseModel):
    winner_name:  str
    total_rounds: int

class GameOut(BaseModel):
    id:           int
    started_at:   datetime
    ended_at:     Optional[datetime]
    winner_name:  Optional[str]
    total_rounds: int

    model_config = {"from_attributes": True}


# ── Round Action ──────────────────────────────────────────────────────────────

class RoundActionIn(BaseModel):
    agent_name: str
    action:     str           # fold | call | raise | check
    amount:     int = 0
    thought:    Optional[str] = None
    hole_cards: Optional[list] = None   # [{rank, suit}, ...]
    hand_rank:  Optional[str] = None

class RoundActionOut(RoundActionIn):
    id: int
    model_config = {"from_attributes": True}


# ── Round ─────────────────────────────────────────────────────────────────────

class RoundCreate(BaseModel):
    round_number:    int
    winner_name:     str
    pot_size:        int
    community_cards: Optional[list] = None
    actions:         list[RoundActionIn] = []

class RoundOut(BaseModel):
    id:              int
    game_id:         int
    round_number:    int
    winner_name:     str
    pot_size:        int
    community_cards: Optional[list]
    created_at:      datetime
    actions:         list[RoundActionOut] = []

    model_config = {"from_attributes": True}


# ── Agent Stats ───────────────────────────────────────────────────────────────

class AgentStats(BaseModel):
    agent_name:    str
    total_rounds:  int
    wins:          int
    losses:        int
    folds:         int
    raises:        int
    calls:         int
    win_rate:      float   # 0.0 – 1.0
    total_earned:  int     # sum of pots won

class LeaderboardEntry(BaseModel):
    rank:       int
    agent_name: str
    wins:       int
    win_rate:   float
    total_earned: int