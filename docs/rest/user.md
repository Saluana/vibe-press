# Users Endpoint Documentation

Base path: `/wp-json/wp/v2/users`

---

## Endpoints

### 1. List Users

**Endpoint**\
`GET /wp-json/wp/v2/users`

**Query Parameters**

| Name                  | Type                                                               | Description                                                                   | Default |
| --------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ------- |
| context               | `view` \| `embed` \| `edit`                                        | Scope under which the request is made; determines fields present in response. | `view`  |
| page                  | integer (>=1)                                                      | Page number for pagination.                                                   | `1`     |
| per\_page             | integer (1–100)                                                    | Number of items per page.                                                     | `10`    |
| search                | string                                                             | Filter users by matching login, email, or display name.                       | —       |
| exclude               | integer or number[]                                                | User ID(s) to exclude.                                                        | —       |
| include               | integer or number[]                                                | User ID(s) to include (override other filters).                               | —       |
| offset                | integer                                                            | Offset number of users to skip.                                               | —       |
| order                 | `asc` \| `desc`                                                    | Sort order.                                                                   | `asc`   |
| orderby               | `id`, `include`, `name`, `registered_date`, `slug`, `email`, `url` | Field to sort by.                                                             | `id`    |
| slug                  | string or string[]                                                 | User nicename(s) to filter.                                                   | —       |
| roles                 | string or string[]                                                 | Role(s) to filter.                                                            | —       |
| capabilities          | string or string[]                                                 | Capability key(s) to filter.                                                  | —       |
| who                   | `authors`                                                          | Return only users with published posts if unauthenticated.                    | —       |
| has\_published\_posts | boolean                                                            | Only authors with published posts (when `who=authors`).                       | —       |

**Authentication**: Optional (`Authorization: Bearer <token>`).

- `edit` context requires `list_users` capability.

**Response**: Array of user objects shaped by the `context` parameter.

**Example**:

```bash
curl -X GET "https://example.com/wp-json/wp/v2/users?context=embed&page=2&per_page=5" \
  -H "Authorization: Bearer <token>"
```

```json
[  
  {
    "id": 5,
    "name": "Jane Doe",
    "slug": "jane-doe",
    "link": "https://example.com/author/jane-doe/",
    "avatar_urls": { "24": "...", "48": "...", "96": "..." },
    "_links": { /* ... */ }
  },
  /* ... */
]
```

---

### 2. Retrieve a User

**Endpoint**\
`GET /wp-json/wp/v2/users/{id}`

**URL Parameters**

| Name | Type    | Description                                           |
| ---- | ------- | ----------------------------------------------------- |
| id   | integer | Unique identifier for the user (or `me` for current). |

**Query Parameters**: Same as List Users (`context`).\
`edit` context requires authentication and `edit_users` capability (owner or privilege).

**Example**:

```bash
curl -X GET "https://example.com/wp-json/wp/v2/users/me?context=edit" \
  -H "Authorization: Bearer <token>"
```

```json
{
  "id": 5,
  "name": "Jane Doe",
  "email": "jane@example.com",
  "url": "",
  "description": "...",
  "link": "https://example.com/author/jane-doe/",
  "slug": "jane-doe",
  "roles": ["author"],
  "capabilities": { /* ... */ },
  "meta": { /* ... */ },
  "registered_date": "2025-01-15T08:30:00",
  "_links": { /* ... */ }
}
```

---

### 3. Create a User

**Endpoint**\
`POST /wp-json/wp/v2/users`

**Authentication**: Required (`create_users` capability).

**Request Body (JSON)**

| Name        | Type                  | Description                                     | Required |
| ----------- | --------------------- | ----------------------------------------------- | -------- |
| username    | string                | Login name for the user.                        | ✓        |
| password    | string                | Password for the user (will never be returned). | ✓        |
| email       | string (email)        | Email address.                                  | ✓        |
| name        | string                | Display name.                                   |          |
| first\_name | string                | First name.                                     |          |
| last\_name  | string                | Last name.                                      |          |
| url         | string (URL)          | User's website URL.                             |          |
| description | string                | Biographical description.                       |          |
| locale      | string (`en_US`)      | Locale.                                         |          |
| nickname    | string                | Nickname.                                       |          |
| slug        | string (alphanumeric) | User nicename (URL-friendly).                   |          |
| roles       | string[]              | Roles to assign.                                |          |
| meta        | object                | Key/value pairs of user meta.                   |          |

**Example Request**:

```bash
curl -X POST https://example.com/wp-json/wp/v2/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "username": "newadmin",
    "password": "P@ssw0rd!",
    "email":    "admin@example.com",
    "name":     "New Admin",
    "roles":   ["administrator"]
}'
```

**Success Response**  **201 Created**

```json
{
  "id": 42,
  "name": "New Admin",
  "slug": "newadmin",
  "email": "admin@example.com",
  "roles": ["administrator"],
  "registered_date": "2025-04-21T13:00:00",
  "_links": { /* WP links */ }
}
```

**Error Response**  **400 Bad Request**

```json
{
  "code": "rest_invalid_param",
  "message": "Invalid parameter(s).",
  "data": {
    "status": 400,
    "details": {
      "password": [{ "_errors": ["Required"] }]
    }
  }
}
```

---

### 4. Update a User

**Endpoint**\
`PUT /wp-json/wp/v2/users/{id}`

**Authentication**: Required (`edit_users` or owner).

**URL Parameter**

| Name | Type    | Description                     |
| ---- | ------- | ------------------------------- |
| id   | integer | ID of user to update (or `me`). |

**Request Body**: Same fields as Create, all optional.

**Success Response** **200 OK**

```json
{
  "id": 5,
  "name": "Jane Smith",
  "email": "jane@example.com",
  "roles": ["editor"],
  "_links": { /* ... */ }
}
```

---

### 5. Delete a User

**Endpoint**\
`DELETE /wp-json/wp/v2/users/{id}?force=true&reassign={reassignId}`

**Authentication**: Required (`delete_users`).

**URL Parameters**

| Name     | Type    | Description                                               | Required |
| -------- | ------- | --------------------------------------------------------- | -------- |
| id       | integer | ID of user to delete.                                     | ✓        |
| force    | `true`  | Must be `true` to actually delete; otherwise returns 400. | ✓        |
| reassign | integer | ID of user to reassign this user’s content to.            | ✓        |

**Success Response** **200 OK**

```json
{
  "deleted": true,
  "previous": { /* limited user object, view shape */ }
}
```

**Error Responses**

- Missing `force=true`: 400 `rest_missing_callback_param`
- Missing/invalid `reassign`: 400 `rest_missing_callback_param`
- Non-existent user: 404 `rest_user_invalid_id`

