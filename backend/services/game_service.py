from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone
from models import Game, Round, RoundAction
from schemas import GameEnd, RoundCreate, AgentStats, LeaderboardEntry


# ── Game ──────────────────────────────────────────────────────────────────────

def create_game(db: Session) -> Game:
    game = Game()
    db.add(game)
    db.commit()
    db.refresh(game)
    return game


def end_game(db: Session, game_id: int, data: GameEnd) -> Game | None:
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        return None
    game.ended_at    = datetime.now(timezone.utc)
    game.winner_name = data.winner_name
    game.total_rounds = data.total_rounds
    db.commit()
    db.refresh(game)
    return game


def get_game(db: Session, game_id: int) -> Game | None:
    return db.query(Game).filter(Game.id == game_id).first()


def get_all_games(db: Session, limit: int = 20) -> list[Game]:
    return db.query(Game).order_by(Game.started_at.desc()).limit(limit).all()


# ── Rounds ────────────────────────────────────────────────────────────────────

def save_round(db: Session, game_id: int, data: RoundCreate) -> Round | None:
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        return None

    round_obj = Round(
        game_id         = game_id,
        round_number    = data.round_number,
        winner_name     = data.winner_name,
        pot_size        = data.pot_size,
        community_cards = data.community_cards,
    )
    db.add(round_obj)
    db.flush()  # get round_obj.id without full commit

    for action in data.actions:
        db.add(RoundAction(
            round_id   = round_obj.id,
            agent_name = action.agent_name,
            action     = action.action,
            amount     = action.amount,
            thought    = action.thought,
            hole_cards = action.hole_cards,
            hand_rank  = action.hand_rank,
        ))

    db.commit()
    db.refresh(round_obj)
    return round_obj


def get_rounds_for_game(db: Session, game_id: int) -> list[Round]:
    return (
        db.query(Round)
        .filter(Round.game_id == game_id)
        .order_by(Round.round_number)
        .all()
    )


# ── Agent Stats ───────────────────────────────────────────────────────────────

def get_agent_stats(db: Session, agent_name: str) -> AgentStats:
    actions = (
        db.query(RoundAction)
        .filter(RoundAction.agent_name == agent_name)
        .all()
    )

    total_rounds = len(set(a.round_id for a in actions))
    folds   = sum(1 for a in actions if a.action == "fold")
    raises  = sum(1 for a in actions if a.action == "raise")
    calls   = sum(1 for a in actions if a.action in ("call", "check"))

    wins = (
        db.query(Round)
        .filter(Round.winner_name == agent_name)
        .count()
    )
    losses = total_rounds - wins

    total_earned = (
        db.query(func.sum(Round.pot_size))
        .filter(Round.winner_name == agent_name)
        .scalar() or 0
    )

    win_rate = round(wins / total_rounds, 3) if total_rounds > 0 else 0.0

    return AgentStats(
        agent_name   = agent_name,
        total_rounds = total_rounds,
        wins         = wins,
        losses       = losses,
        folds        = folds,
        raises       = raises,
        calls        = calls,
        win_rate     = win_rate,
        total_earned = total_earned,
    )


def get_leaderboard(db: Session) -> list[LeaderboardEntry]:
    # All distinct agent names across all rounds
    names = [
        row[0] for row in
        db.query(RoundAction.agent_name).distinct().all()
    ]

    entries = []
    for name in names:
        stats = get_agent_stats(db, name)
        entries.append(LeaderboardEntry(
            rank         = 0,
            agent_name   = stats.agent_name,
            wins         = stats.wins,
            win_rate     = stats.win_rate,
            total_earned = stats.total_earned,
        ))

    entries.sort(key=lambda e: (e.wins, e.win_rate), reverse=True)
    for i, e in enumerate(entries):
        e.rank = i + 1

    return entries