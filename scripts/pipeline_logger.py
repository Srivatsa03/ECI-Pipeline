"""Reads stdin line by line and writes each line to pipeline_logs in Supabase."""
import sys
import os
import psycopg2

def main():
    job_id = int(sys.argv[1])
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        for line in sys.stdin:
            sys.stdout.write(line)
            sys.stdout.flush()
        return

    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()

    for line in sys.stdin:
        line = line.rstrip('\n')
        sys.stdout.write(line + '\n')
        sys.stdout.flush()
        try:
            cur.execute(
                "INSERT INTO pipeline_logs (job_id, log_line) VALUES (%s, %s)",
                (job_id, line[:1000])
            )
        except Exception:
            pass

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
