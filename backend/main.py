from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from database import engine, Base
from routers import games, rounds, agents

load_dotenv()

# Create all tables on startup (SQLite auto-creates the file too)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Poker Agents API", version="1.0.0")

# CORS — allow the Vite dev server to call us
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORS_ORIGIN", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(games.router)
app.include_router(rounds.router)
app.include_router(agents.router)


@app.get("/")
def root():
    return {"status": "Poker Agents API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}