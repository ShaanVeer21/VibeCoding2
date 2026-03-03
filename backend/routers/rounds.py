from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from schemas import RoundOut, RoundCreate
from services.game_service import save_round, get_rounds_for_game

router = APIRouter(prefix="/games/{game_id}/rounds", tags=["rounds"])


@router.post("", response_model=RoundOut)
def create_round(game_id: int, data: RoundCreate, db: Session = Depends(get_db)):
    """Save a completed round with all agent actions."""
    round_obj = save_round(db, game_id, data)
    if not round_obj:
        raise HTTPException(status_code=404, detail="Game not found")
    return round_obj


@router.get("", response_model=list[RoundOut])
def fetch_rounds(game_id: int, db: Session = Depends(get_db)):
    """Get all rounds for a game in order."""
    return get_rounds_for_game(db, game_id)