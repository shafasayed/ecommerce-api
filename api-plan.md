# API plan

## Registration and login
POST /auth/register — Create an account
POST /auth/login — Log in
POST /auth/logout — Log out

## User account — logged-in user only
GET /users/me — View my account
PATCH /users/me — Update my account
DELETE /users/me — Delete my account

## Products
GET /products — List products
GET /products/:id — View one product
POST /products — Create a product (admin only)
PATCH /products/:id — Update a product (admin only)
DELETE /products/:id — Delete a product (admin only)

## Cart — logged-in user's own cart
POST /cart — Create a cart
GET /cart — View the cart
POST /cart/items — Add a product
PATCH /cart/items/:id — Change an item's quantity
DELETE /cart/items/:id — Remove an item
DELETE /cart — Delete the cart

## Checkout and orders — logged-in user's own orders
POST /cart/checkout — Create an order from the cart
GET /orders — List my orders
GET /orders/:id — View one order
PATCH /orders/:id — Cancel a pending order
DELETE /orders/:id — Delete a cancelled order