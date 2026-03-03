from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from schemas import AgentStats, LeaderboardEntry
from services.game_service import get_agent_stats, get_leaderboard

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
def fetch_leaderboard(db: Session = Depends(get_db)):
    """All-time stats across every game ever played."""
    return get_leaderboard(db)


@router.get("/{agent_name}/history", response_model=AgentStats)
def fetch_agent_history(agent_name: str, db: Session = Depends(get_db)):
    """Win/loss/fold/raise stats for a specific agent across all games."""
    return get_agent_stats(db, agent_name)