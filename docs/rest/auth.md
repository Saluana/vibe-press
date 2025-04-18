# Authentication API Documentation

This document outlines the available authentication endpoints for user registration and login.

## Base URL

```
http://localhost:4000/wp-json/wp/v2
```

---

## 🔐 Register User

**POST** `/register`  
Registers a new user with the provided credentials.

### Request Body

| Field         | Type   | Required | Description                                            |
|---------------|--------|----------|--------------------------------------------------------|
| `username`    | string | Yes      | Desired username                                       |
| `email`       | string | Yes      | User's email address                                   |
| `password`    | string | Yes      | Password for the new account                           |
| `display_name`| string | No       | Optional display name (defaults to `username` if empty)|

### Example Request

```bash
curl -X POST "http://localhost:4000/wp-json/wp/v2/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "email": "newuser@example.com",
    "password": "securepassword123",
    "display_name": "New User"
  }'
```

### Responses

- **201 Created**  
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 123,
      "username": "newuser",
      "email": "newuser@example.com",
      "display_name": "New User"
    }
  }
  ```

- **400 Bad Request** – Validation failed  
  ```json
  {
    "code": "400",
    "message": "Validation failed",
    "status": 400,
    "data": {
      "details": "Detailed error message"
    }
  }
  ```

- **409 Conflict** – Duplicate user  
  ```json
  {
    "code": "23505",
    "message": "A user with that email or username already exists."
  }
  ```

- **500 Server Error** – Registration failed  
  ```json
  {
    "code": "500",
    "message": "Failed to register user"
  }
  ```

---

## 🔓 Login

**POST** `/login`  
Authenticates an existing user and returns a JWT token.

### Request Body

| Field      | Type   | Required | Description               |
|------------|--------|----------|---------------------------|
| `username` | string | Yes      | The user's login username |
| `password` | string | Yes      | The user's password       |

### Example Request

```bash
curl -X POST "http://localhost:4000/wp-json/wp/v2/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "password": "securepassword123"
  }'
```

### Responses

- **200 OK**  
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 123,
      "username": "newuser",
      "email": "newuser@example.com",
      "display_name": "New User"
    }
  }
  ```

- **400 Bad Request** – Validation failed  
  ```json
  {
    "code": "400",
    "message": "Validation failed",
    "status": 400,
    "data": {
      "details": "Detailed error message"
    }
  }
  ```

- **500 Server Error** – Login failed  
  ```json
  {
    "code": "500",
    "message": "Failed to login"
  }
  ```
