# Database plan

- users: id, name, email, password_hash
- products: id, name, description, price, stock
- carts: id, user_id
- cart_items: id, cart_id, product_id, quantity
- orders: id, user_id, status, total, created_at
- order_items: id, order_id, product_id, quantity, unit_price

## Relationships

- Each user has one cart.
- A cart can contain many cart items.
- Each cart item refers to a product.
- A user can place many orders.
- An order can contain many order items.
- Each order item stores the price paid for its product.