# E-commerce REST API

A Codecademy portfolio project built with Node.js, Express, and PostgreSQL.

This application provides a backend API for managing accounts, products,
shopping carts, and orders, with Stripe handling payment during checkout.
It pairs with a separate React frontend,
[ecommerce-client](https://github.com/shafasayed/ecommerce-client).

## Live demo

- API: https://ecommerce-api-oyot.onrender.com
- Frontend: https://ecommerce-client-ucsk.onrender.com
- API docs: https://ecommerce-api-oyot.onrender.com/api-docs

Both are hosted on Render's free tier. The API spins down after periods of
inactivity, so the first request after a while can take 30-60 seconds.

## Features

- Account registration with hashed passwords
- Login and logout using sessions stored in PostgreSQL
- View, update, and delete your own account
- Public product browsing
- Admin-only product creation, updates, and deletion
- Personal shopping carts and item quantities
- Checkout with Stripe payment, stock validation, and database transactions
- Order viewing, cancellation, and deletion
- Swagger API documentation

## Technologies

- Node.js and Express
- PostgreSQL and node-postgres (`pg`)
- bcryptjs
- express-session and connect-pg-simple
- Swagger UI
- Git

## Requirements

The project was developed using Node.js 24 and PostgreSQL 18.

Install Node.js, npm, Git, and PostgreSQL before starting.
PostgreSQL must be running.

On macOS, Postgres.app should be installed in Applications.

## Local setup

### 1. Open the project

Download or clone this repository, then open a terminal in its folder.

### 2. Install dependencies

```bash
npm ci
```

### 3. Make PostgreSQL commands available

For Postgres.app on macOS, run this in the terminal you are using:

```bash
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"
```

This PATH change applies to the current terminal session.

### 4. Create a fresh database and import the schema

These commands assume your local PostgreSQL role matches your computer
username, as in a default Postgres.app installation.

```bash
createdb ecommerce
psql -v ON_ERROR_STOP=1 -d ecommerce -f schema.sql
```

Import the schema into an empty database. If you already completed setup,
do not import it again into the existing database.

The schema includes tables and constraints, but no sample accounts or products.

### 5. Configure environment variables

Create a local settings file:

```bash
cp .env.example .env
```

Configure these values in `.env`:

```text
PGHOST=localhost
PGPORT=5432
PGDATABASE=ecommerce
PGUSER=your_postgresql_username
SESSION_SECRET=your_generated_secret
```

If your PostgreSQL installation requires a password, also set `PGPASSWORD`.

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the generated value into `SESSION_SECRET`.

Never commit `.env` or session cookie files to Git.

### 6. Start the application

```bash
npm run dev
```

Development mode automatically restarts the server when code changes.

Alternatively:

```bash
npm start
```

Keep the server terminal running. Use a separate terminal for test commands.

### 7. Open the documentation

Visit:

http://localhost:3000/api-docs

Use POST /auth/register to create an account, then POST /auth/login to log in.

Swagger requests from this application use the browser's session cookie.
Browser sessions are separate from cookie files used by curl.

## Creating an administrator

New accounts have the customer role.

Register an account first. Then connect to the database:

```bash
psql -d ecommerce
```

Run the following SQL, replacing the email with your registered email:

```sql
UPDATE users
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

Exit psql with:

```text
\q
```

Use the admin account to create products through POST /products.

Example product request:

```json
{
  "name": "Notebook",
  "description": "A lined notebook",
  "price": "4.99",
  "stock": 20
}
```

## API routes

### Authentication

- POST /auth/register
- POST /auth/login
- POST /auth/logout

### My account

- GET /users/me
- PATCH /users/me
- DELETE /users/me

### Products

- GET /products
- GET /products/:id
- POST /products — admin only
- PATCH /products/:id — admin only
- DELETE /products/:id — admin only

### My cart

- POST /cart
- GET /cart
- POST /cart/items
- PATCH /cart/items/:id
- DELETE /cart/items/:id
- DELETE /cart

Cart item IDs are different from product IDs.

### Checkout and orders

- POST /cart/checkout
- GET /orders
- GET /orders/:id
- PATCH /orders/:id — cancel a pending order
- DELETE /orders/:id — delete a cancelled order

Example cancellation request:

```json
{
  "status": "cancelled"
}
```

## Database design

- users: account details, password hashes, and roles
- products: product details, prices, and stock
- carts: cart ownership
- cart_items: products and quantities in carts
- orders: order ownership, status, total, and creation time
- order_items: purchased quantities, product names, and purchase prices
- session: stored login sessions

Foreign keys connect related records.

Purchase names and prices are stored in order items so historical orders
remain understandable when products change.

## Checkout behaviour

Adding a product to a cart does not reserve stock.

Checkout validates stock, creates an order and its items, reduces stock,
and clears the cart within a database transaction.

If checkout fails, its database changes are rolled back.

Cancelling a pending order restores available product stock.
A second cancellation is rejected to avoid restoring stock twice.

Money is stored using PostgreSQL NUMERIC values. Decimal prices may appear
as strings in JSON responses to preserve precision.

## Manual checks performed

- Registration succeeds and duplicate emails are rejected
- Correct passwords allow login; incorrect passwords are rejected
- Logout invalidates access to protected account routes
- Accounts can be viewed, updated, and deleted
- Admins can create, update, and delete products
- Customers cannot create products
- Cart items can be added, updated, and removed
- Another account cannot update someone else's cart item
- Checkout creates an order and reduces stock
- Insufficient-stock checkout leaves the cart and stock unchanged
- Cancellation restores stock only once
- Cancelled orders can be deleted
- Swagger login and protected account requests work

These are manual checks, not an automated test suite.

## Troubleshooting

### EADDRINUSE

Another process is using port 3000. Stop the existing API server before
starting another. Run only one development server for this project.

### curl does not execute

Run curl in a separate terminal showing a shell prompt, not in the terminal
occupied by the running server.

### 401 Unauthorized

Log in again. Sessions expire, and curl must send its saved session cookie.

### PostgreSQL connection fails

Check that PostgreSQL is running and that `.env` contains the correct
database name, username, host, port, and password if required.

## Scope and future improvements

This is a learning project, not a production system.

Potential improvements include automated integration and concurrency tests,
pagination, password reset, email verification, login rate limiting,
CSRF protection, and third-party login (Google/Facebook) — skipped here to
keep the project scoped to a single working session.

### Known limitation: session login on Safari

The API and frontend are deployed on two different Render domains. Safari's
tracking-prevention rules block cookies set this way ("third-party cookies")
more aggressively than other browsers, so a logged-in session may not
persist across page loads there, even though login itself succeeds and
works correctly in other browsers. The properly production-ready fix is to
replace cookie-based sessions with a token sent in an Authorization header,
which isn't subject to third-party cookie rules.

## What I learned

- Structuring an Express API with routers and middleware
- Authentication versus authorization
- Password hashing and session-based login
- Parameterized SQL queries
- Database relationships and constraints
- Transactions for related database changes
- HTTP methods and status codes
- Documenting and testing an API with Swagger