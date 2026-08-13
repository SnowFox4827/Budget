# Budget App

A modern, dark-themed zero-based envelope budgeting web application built with **Flask**, **HTML5**, **JavaScript**, **CSS3**, and **SQLite**.

---

## Features

- **Zero-Based Budgeting:** Track Total Net Worth, Total Allocated Funds, and global Unassigned Dollars in real time.
- **Account Management:** Add, rename, and manage multiple financial accounts (Checking, Savings, Cash, etc.).
- **Envelopes & Allocations:** 
  - Create funding goals tied to specific accounts.
  - Set target amounts, target dates, and track visual progress bars.
  - Filter allocations by account.
  - Deleting an allocation automatically returns remaining funds to **Unassigned Dollars**.
- **Transactions & Overspend Protection:**
  - Log expenses, income, and envelope transfers.
  - Edit or delete transactions with automated balance recalculations.
  - Slicers/Filters to search transactions by description, account, allocation, or transaction type.
  - Automatic **Overspend Warning**: prompts you to select where to cover shortfall when spending exceeds envelope limits.
- **Reallocate / Move Funds:** Shift dollars between allocations or to/from the unassigned pool.

---

## Tech Stack

- **Backend:** Python 3 / Flask
- **Database:** SQLite3
- **Frontend:** HTML5, Modern CSS3 (Dark Theme), Vanilla JavaScript (ES6)
- **UI Framework:** Bootstrap 5 & Bootstrap Icons
- **Containerization:** Docker & Docker Compose

---

## Project Structure

```
budget_app/
├── app.py                  # Flask backend & SQLite API endpoints
├── requirements.txt        # Python package dependencies
├── data/
│   └── budget.db           # SQLite database stored in data/ folder
├── Dockerfile              # Docker container definition
├── docker-compose.yml      # Docker Compose configuration (mounts ./data)
├── .gitignore              # Git ignore rules
├── .dockerignore           # Docker build ignore rules
├── README.md               # Project documentation
├── static/
│   ├── css/
│   │   └── styles.css      # Dark theme styling
│   └── js/
│       └── main.js         # Frontend logic & API interaction
└── templates/
    └── index.html          # Main single-page dashboard layout
```

---

## Getting Started

### Option 1: Running Locally with Python

1. **Prerequisites:** Python 3.8+ installed.
2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
3. **Run application:**
   ```bash
   python app.py
   ```
4. **Access app:** Open `http://localhost:5000` in your web browser.

> **Changing the Port:**
> To run on a different port locally (e.g., `8080`), edit the bottom of `app.py`:
> ```python
> app.run(host='0.0.0.0', port=8080, debug=True)
> ```

---

### Option 2: Running with Docker

1. **Build and start container in detached mode:**
   ```bash
   docker compose up -d --build
   ```
2. **Access app:** Open `http://localhost:5000` in your web browser.
3. **Stop container:**
   ```bash
   docker compose down
   ```

> **Changing the Port in Docker:**
> To expose the app on a different host port (e.g., access via `http://localhost:8080`), update the `ports` section in `docker-compose.yml`:
> ```yaml
> ports:
>   - "8080:5000"   # "HOST_PORT:CONTAINER_PORT"
> ```

---

## License

Personal Homelab Use
