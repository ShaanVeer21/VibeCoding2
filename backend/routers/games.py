from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from schemas import GameOut, GameEnd
from services.game_service import create_game, end_game, get_game, get_all_games

router = APIRouter(prefix="/games", tags=["games"])


@router.post("", response_model=GameOut)
def start_game(db: Session = Depends(get_db)):
    """Call this when the simulation starts. Returns a game_id to use for all subsequent calls."""
    return create_game(db)


@router.patch("/{game_id}/end", response_model=GameOut)
def finish_game(game_id: int, data: GameEnd, db: Session = Depends(get_db)):
    """Call when tournament ends. Saves winner + total rounds."""
    game = end_game(db, game_id, data)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


@router.get("/{game_id}", response_model=GameOut)
def fetch_game(game_id: int, db: Session = Depends(get_db)):
    game = get_game(db, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


@router.get("", response_model=list[GameOut])
def fetch_all_games(limit: int = 20, db: Session = Depends(get_db)):
    return get_all_games(db, limit)