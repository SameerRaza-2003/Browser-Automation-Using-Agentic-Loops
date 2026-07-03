import sqlite3

conn = sqlite3.connect("customers.db")
cur = conn.cursor()

cur.execute("""
INSERT INTO customers (
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
""", (
    "Sameer",
    "Raza Malik",
    "sameer.raza@example.com",
    "Male",
    "03282244415",
    "2003-12-15",
    "Korang Town",
    "Islamabad Capital Territory",
    "Islamabad",
    "Computer Science",
    "Coding"
))

conn.commit()
conn.close()

print("Customer added successfully!")