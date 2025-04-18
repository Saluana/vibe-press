# Users API Documentation

Provides access to registered users with support for pagination, filtering, and sorting.

## Base URL

```
http://localhost:4000/wp-json/wp/v2
```

---

## 📄 Get Users

**GET** `/users`  
Fetch a list of users with optional query parameters for filtering, sorting, and pagination.

### Query Parameters

| Parameter           | Type                        | Required | Description                                                                 |
|---------------------|-----------------------------|----------|-----------------------------------------------------------------------------|
| `context`           | `view` \| `embed` \| `edit` | No       | The response context (default: `view`)                                      |
| `page`              | number                      | No       | Page number for pagination (default: `1`)                                   |
| `per_page`          | number                      | No       | Number of results per page (default: `10`)                                  |
| `search`            | string                      | No       | Limit results to those matching a search string                             |
| `exclude`           | number or number[]          | No       | Exclude specific user IDs from results                                      |
| `include`           | number or number[]          | No       | Only include specific user IDs                                              |
| `offset`            | number                      | No       | Offset the result set by a specific number                                  |
| `order`             | `asc` \| `desc`             | No       | Sort order (default: `asc`)                                                 |
| `orderby`           | `id` \| `name` \| `slug` \| `email` \| `url` \| `registered_date` | No | Field to sort by                                             |
| `slug`              | string or string[]          | No       | Filter by user slug(s)                                                      |
| `roles`             | string or string[]          | No       | Filter by role(s)                                                           |
| `capabilities`      | string or string[]          | No       | Filter by user capabilities                                                 |
| `who`               | `authors`                   | No       | Return only users who are authors                                           |
| `has_published_posts` | boolean                   | No       | Filter by users who have published posts                                    |

### Example Request

```bash
curl -X GET "http://localhost:4000/wp-json/wp/v2/users?page=2&per_page=5&roles=subscriber"
```

### Successful Response

- **200 OK**  
Returns a list of users matching the criteria.

```json
[
  {
    "ID": 123,
    "username": "jdoe",
    "email": "jdoe@example.com",
    "name": "John Doe",
    "first_name": "John",
    "last_name": "Doe",
    "url": "https://johndoe.com",
    "description": "Writer and blogger",
    "locale": "en_US",
    "nickname": "Johnny",
    "slug": "jdoe",
    "roles": ["subscriber"],
    "meta": {}
  }
]
```

### Error Responses

- **400 Bad Request** – Invalid query parameters  
  ```json
  {
    "code": "400",
    "message": "Invalid query parameters",
    "status": 400,
    "data": {
      "details": "There was an issue with one or more provided query parameters."
    }
  }
  ```

- **500 Server Error** – Unexpected internal error  
  ```json
  {
    "code": "500",
    "message": "Unknown error"
  }
  ```