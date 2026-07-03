
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

DUMMY_CUSTOMERS = [
    (
        "Ayesha", "Khan", "ayesha.khan@example.com", "Female", "03001234567",
        "1998-04-12", "House 12, Street 5, F-10",
        "Islamabad Capital Territory", "Islamabad",
        "Maths,Physics", "Reading,Music"
    ),
    (
        "Bilal", "Ahmed", "bilal.ahmed@example.com", "Male", "03009876543",
        "1995-11-02", "Street 8, Bahria Town",
        "Punjab", "Rawalpindi",
        "Chemistry", "Cricket"
    ),
    (
        "Sara", "Malik", "sara.malik@example.com", "Female", "03211234567",
        "2000-01-20", "House 8, DHA Phase 2",
        "Punjab", "Lahore",
        "Biology,English", "Painting"
    ),
    (
        "Usman", "Raza", "usman.raza@example.com", "Male", "03451237890",
        "1997-07-15", "Street 9, University Town",
        "Khyber Pakhtunkhwa", "Peshawar",
        "Physics,Computer Science", "Football,Gaming"
    ),
    (
        "Hina", "Yousaf", "hina.yousaf@example.com", "Female", "03339876543",
        "1999-09-09", "House 3, Gulshan-e-Iqbal",
        "Sindh", "Karachi",
        "English", "Dancing"
    ),
    (
        "Sameer", "Raza Malik", "sameer.raza@example.com", "Male", "03282244415",
        "2003-12-15", "Korang Town",
        "Islamabad Capital Territory", "Islamabad",
        "Computer Science", "Coding"
    ),
]


def setup_database():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute(SCHEMA)

    cur.execute("SELECT COUNT(*) FROM customers")
    if cur.fetchone()[0] == 0:
        cur.executemany(
            """
            INSERT INTO customers
            (
                first_name,
                last_name,
                email,
                gender,
                mobile,
                date_of_birth,
                address,
                state,
                city,
                subjects,
                hobbies
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            DUMMY_CUSTOMERS,
        )

        conn.commit()
        print(f"Seeded {len(DUMMY_CUSTOMERS)} dummy customers into {DB_PATH}")
    else:
        print("Database already seeded — skipping.")

    conn.close()


if __name__ == "__main__":
    setup_database()