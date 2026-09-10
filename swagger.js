const ref = (name) => ({
  $ref: `#/components/schemas/${name}`
});

const arrayOf = (name) => ({
  type: 'array',
  items: ref(name)
});

const jsonResponse = (description, schema) => ({
  description,
  content: {
    'application/json': { schema }
  }
});

const errorResponse = (description) =>
  jsonResponse(description, ref('Error'));

const idParameter = {
  name: 'id',
  in: 'path',
  required: true,
  description: 'The ID of the resource',
  schema: {
    type: 'integer',
    minimum: 1,
    maximum: 2147483647
  }
};

// Build consistently documented operations.
function operation(
  tag,
  summary,
  responseSchema,
  {
    secured = false,
    body,
    id = false,
    status = 200,
    description = ''
  } = {}
) {
  const result = {
    tags: [tag],
    summary,
    description,
    security: secured ? [{ sessionCookie: [] }] : [],
    responses: {
      [status]: jsonResponse('Successful response', responseSchema),
      400: errorResponse('Invalid request'),
      401: errorResponse('Login required or invalid credentials'),
      403: errorResponse('Admin access required'),
      404: errorResponse('Resource not found'),
      409: errorResponse('Conflict with current resource state'),
      500: errorResponse('Server error')
    }
  };

  if (id) {
    result.parameters = [idParameter];
  }

  if (body) {
    result.requestBody = {
      required: true,
      content: {
        'application/json': { schema: body }
      }
    };
  }

  return result;
}

const productFields = {
  name: {
    type: 'string',
    minLength: 1,
    maxLength: 150,
    example: 'Notebook'
  },
  description: {
    type: 'string',
    example: 'A lined notebook'
  },
  price: {
    description: 'Exact decimal amount, up to two decimal places',
    oneOf: [
      {
        type: 'string',
        pattern: '^\\d{1,8}(\\.\\d{1,2})?$',
        example: '4.99'
      },
      {
        type: 'number',
        minimum: 0,
        maximum: 99999999.99,
        multipleOf: 0.01
      }
    ]
  },
  stock: {
    type: 'integer',
    minimum: 0,
    maximum: 2147483647,
    example: 20
  }
};

const specification = {
  openapi: '3.0.3',
  info: {
    title: 'E-commerce REST API',
    version: '1.0.0',
    description:
      'A learning project built with Express and PostgreSQL. ' +
      'Register and log in through the Auth endpoints. ' +
      'Swagger UI uses the login cookie automatically when served ' +
      'from this application. Products can be browsed publicly; ' +
      'product mutations require an admin. Checkout creates an order ' +
      'without processing a payment.'
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Auth' },
    { name: 'Users' },
    { name: 'Products' },
    { name: 'Cart' },
    { name: 'Orders' }
  ],
  components: {
    securitySchemes: {
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'connect.sid',
        description:
          'Created by POST /auth/login. Log in using Swagger Try it out.'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' }
        }
      },
      Message: {
        type: 'object',
        properties: {
          message: { type: 'string' }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' }
        }
      },
      UserResponse: {
        type: 'object',
        properties: {
          user: ref('User')
        }
      },
      LoginResponse: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          user: ref('User')
        }
      },
      Registration: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          email: {
            type: 'string',
            format: 'email',
            maxLength: 255
          },
          password: {
            type: 'string',
            format: 'password',
            minLength: 8,
            description: 'Maximum 72 UTF-8 bytes'
          }
        }
      },
      Login: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password' }
        }
      },
      UserUpdate: {
        type: 'object',
        minProperties: 1,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          email: {
            type: 'string',
            format: 'email',
            maxLength: 255
          }
        }
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          price: {
            type: 'string',
            description: 'PostgreSQL decimal returned as a string',
            example: '4.99'
          },
          stock: { type: 'integer' }
        }
      },
      ProductCreate: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'price'],
        properties: productFields
      },
      ProductUpdate: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: productFields
      },
      CartCreated: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          user_id: { type: 'integer' }
        }
      },
      CartItem: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'Cart item ID, used for updates and removal'
          },
          cart_id: { type: 'integer' },
          product_id: { type: 'integer' },
          name: { type: 'string' },
          quantity: { type: 'integer' },
          unit_price: { type: 'string' },
          subtotal: { type: 'string' }
        }
      },
      Cart: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          items: arrayOf('CartItem'),
          total: { type: 'string' }
        }
      },
      AddCartItem: {
        type: 'object',
        required: ['product_id'],
        properties: {
          product_id: {
            type: 'integer',
            minimum: 1,
            maximum: 2147483647
          },
          quantity: {
            type: 'integer',
            minimum: 1,
            maximum: 2147483647,
            default: 1
          }
        }
      },
      QuantityUpdate: {
        type: 'object',
        required: ['quantity'],
        properties: {
          quantity: {
            type: 'integer',
            minimum: 1,
            maximum: 2147483647
          }
        }
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          user_id: { type: 'integer', nullable: true },
          status: {
            type: 'string',
            enum: ['pending', 'completed', 'cancelled']
          },
          total: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' }
        }
      },
      OrderItem: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          product_id: { type: 'integer', nullable: true },
          product_name: { type: 'string' },
          quantity: { type: 'integer' },
          unit_price: { type: 'string' }
        }
      },
      OrderDetail: {
        allOf: [
          ref('Order'),
          {
            type: 'object',
            properties: {
              items: arrayOf('OrderItem')
            }
          }
        ]
      },
      CheckoutResponse: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          order: ref('Order')
        }
      },
      CancelOrder: {
        type: 'object',
        additionalProperties: false,
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['cancelled'] }
        }
      }
    }
  },
  paths: {
    '/auth/register': {
      post: operation('Auth', 'Register an account', ref('UserResponse'), {
        body: ref('Registration'),
        status: 201
      })
    },
    '/auth/login': {
      post: operation('Auth', 'Log in', ref('LoginResponse'), {
        body: ref('Login')
      })
    },
    '/auth/logout': {
      post: operation('Auth', 'Log out', ref('Message'), {
        secured: true
      })
    },
    '/users/me': {
      get: operation('Users', 'View my account', ref('UserResponse'), {
        secured: true
      }),
      patch: operation('Users', 'Update my account', ref('UserResponse'), {
        secured: true,
        body: ref('UserUpdate')
      }),
      delete: operation('Users', 'Delete my account', ref('Message'), {
        secured: true
      })
    },
    '/products': {
      get: operation('Products', 'List products', arrayOf('Product')),
      post: operation('Products', 'Create a product — admin only', ref('Product'), {
        secured: true,
        body: ref('ProductCreate'),
        status: 201
      })
    },
    '/products/{id}': {
      get: operation('Products', 'View one product', ref('Product'), {
        id: true
      }),
      patch: operation('Products', 'Update a product — admin only', ref('Product'), {
        secured: true,
        id: true,
        body: ref('ProductUpdate')
      }),
      delete: operation('Products', 'Delete a product — admin only', ref('Message'), {
        secured: true,
        id: true
      })
    },
    '/cart': {
      post: operation('Cart', 'Create my cart', ref('CartCreated'), {
        secured: true,
        status: 201
      }),
      get: operation('Cart', 'View my cart', ref('Cart'), {
        secured: true
      }),
      delete: operation('Cart', 'Delete my cart', ref('Message'), {
        secured: true
      })
    },
    '/cart/items': {
      post: operation('Cart', 'Add a product or increase its quantity', ref('CartItem'), {
        secured: true,
        body: ref('AddCartItem'),
        description: 'Cart quantities do not reserve stock. Stock is checked at checkout.'
      })
    },
    '/cart/items/{id}': {
      patch: operation('Cart', 'Change a cart item quantity', ref('CartItem'), {
        secured: true,
        id: true,
        body: ref('QuantityUpdate')
      }),
      delete: operation('Cart', 'Remove a cart item', ref('Message'), {
        secured: true,
        id: true
      })
    },
    '/cart/checkout': {
      post: operation('Orders', 'Place an order from my cart', ref('CheckoutResponse'), {
        secured: true,
        status: 201,
        description:
          'Creates a pending order, reduces stock, and clears cart items ' +
          'in one transaction. Does not process payment. A concurrency ' +
          'conflict returns 409; refresh state before retrying.'
      })
    },
    '/orders': {
      get: operation('Orders', 'List my orders', arrayOf('Order'), {
        secured: true
      })
    },
    '/orders/{id}': {
      get: operation('Orders', 'View my order and its items', ref('OrderDetail'), {
        secured: true,
        id: true
      }),
      patch: operation('Orders', 'Cancel my pending order', ref('Order'), {
        secured: true,
        id: true,
        body: ref('CancelOrder'),
        description: 'Restores stock for products that still exist.'
      }),
      delete: operation('Orders', 'Delete my cancelled order', ref('Message'), {
        secured: true,
        id: true
      })
    }
  }
};

module.exports = specification;