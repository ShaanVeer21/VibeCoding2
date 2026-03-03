from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


class Game(Base):
    __tablename__ = "games"

    id           = Column(Integer, primary_key=True, index=True)
    started_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    ended_at     = Column(DateTime, nullable=True)
    winner_name  = Column(String, nullable=True)
    total_rounds = Column(Integer, default=0)

    rounds = relationship("Round", back_populates="game", cascade="all, delete-orphan")


class Round(Base):
    __tablename__ = "rounds"

    id               = Column(Integer, primary_key=True, index=True)
    game_id          = Column(Integer, ForeignKey("games.id"), nullable=False)
    round_number     = Column(Integer, nullable=False)
    winner_name      = Column(String, nullable=False)
    pot_size         = Column(Integer, nullable=False)
    community_cards  = Column(JSON, nullable=True)   # list of {rank, suit}
    created_at       = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    game    = relationship("Game", back_populates="rounds")
    actions = relationship("RoundAction", back_populates="round", cascade="all, delete-orphan")


class RoundAction(Base):
    __tablename__ = "round_actions"

    id          = Column(Integer, primary_key=True, index=True)
    round_id    = Column(Integer, ForeignKey("rounds.id"), nullable=False)
    agent_name  = Column(String, nullable=False)
    action      = Column(String, nullable=False)   # fold | call | raise | check
    amount      = Column(Integer, default=0)
    thought     = Column(String, nullable=True)
    hole_cards  = Column(JSON, nullable=True)       # [{rank, suit}, {rank, suit}]
    hand_rank   = Column(String, nullable=True)     # "Full House", "Flush", etc.

    round = relationship("Round", back_populates="actions")