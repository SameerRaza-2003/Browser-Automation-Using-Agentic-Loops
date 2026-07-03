"""
Creates and seeds a small local SQLite database of dummy customers.

Run this once before anything else: python db_setup.py
"""

import sqlite3

DB_PATH = "customers.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    gender TEXT NOT NULL,
    mobile TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    address TEXT NOT NULL,
    state TEXT NOT NULL,
    city TEXT NOT NULL,
    subjects TEXT,
    hobbies TEXT
);
"""

# State/city pairs match demoqa.com's actual dropdown values, so the
# browser agent can select them without hitting a "no such option" wall.
DUMMY_CUSTOMERS = [
    ("Ayesha", "Khan", "ayesha.khan@example.com", "Female", "3001234567",
     "1998-04-12", "House 12, Street 5, F-10", "NCR", "Delhi",
     "Maths,Physics", "Reading,Music"),
    ("Bilal", "Ahmed", "bilal.ahmed@example.com", "Male", "3009876543",
     "1995-11-02", "Flat 4B, Bahria Town", "NCR", "Gurgaon",
     "Chemistry", "Cricket"),
    ("Sara", "Malik", "sara.malik@example.com", "Female", "3211234567",
     "2000-01-20", "House 8, DHA Phase 2", "Rajasthan", "Jaipur",
     "Biology,English", "Painting"),
    ("Usman", "Raza", "usman.raza@example.com", "Male", "3451237890",
     "1997-07-15", "Street 9, G-11", "Uttar Pradesh", "Agra",
     "Physics,Computer Science", "Football,Gaming"),
    ("Hina", "Yousaf", "hina.yousaf@example.com", "Female", "3339876543",
     "1999-09-09", "House 3, Model Town", "Haryana", "Karnal",
     "English", "Dancing"),
]


def setup_database():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(SCHEMA)
    cur.execute("SELECT COUNT(*) FROM customers")
    if cur.fetchone()[0] == 0:
        cur.executemany(
            """INSERT INTO customers
               (first_name, last_name, email, gender, mobile, date_of_birth,
                address, state, city, subjects, hobbies)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            DUMMY_CUSTOMERS,
        )
        conn.commit()
        print(f"Seeded {len(DUMMY_CUSTOMERS)} dummy customers into {DB_PATH}")
    else:
        print("Database already seeded — skipping.")
    conn.close()


if __name__ == "__main__":
    setup_database()
