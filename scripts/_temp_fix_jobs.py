from sqlalchemy import text
from utils.db import engine

def fix_stuck_jobs():
    with engine.begin() as conn:
        result = conn.execute(text("UPDATE pipeline_jobs SET status = 'failed' WHERE status IN ('pending', 'running')"))
        print(f"Fixed {result.rowcount} stuck jobs.")

if __name__ == "__main__":
    fix_stuck_jobs()
