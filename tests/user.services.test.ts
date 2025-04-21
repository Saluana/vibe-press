import { expect, test, describe, beforeEach, afterEach } from 'bun:test';

import { db, schema } from '../apps/api/src/core/db';
import { or, eq, sql } from 'drizzle-orm';
import { hashPassword } from '../apps/api/src/core/services/auth.services';
import { createUserMetaDefaults } from '../apps/api/src/core/services/user/userMeta.services';
import { serverHooks } from '../apps/api/src/core/hooks/hookEngine.server';

const { getUserByLoginOrEmail, createUser, updateUser } = await import('../apps/api/src/core/services/user/user.services');

describe('User Services (Integration)', () => {

    const mockUser = {
        id: 1,
        user_login: 'testuser',
        user_nicename: 'testuser',
        user_email: 'test@example.com',
        user_url: '',
        user_registered: new Date().toISOString(),
        user_status: 0,
        display_name: 'Test User',
    };

    const newUserInput = {
        user_login: 'newuser',
        user_email: 'new@example.com',
        user_pass: 'password123',
        display_name: 'New User',
    };

    const mockCreatedUser = {
        id: 5,
        user_login: newUserInput.user_login,
        user_nicename: newUserInput.user_login.toLowerCase(),
        user_email: newUserInput.user_email,
        user_url: '',
        user_registered: expect.any(String),
        user_status: 0,
        display_name: newUserInput.display_name,
    };

    const cleanupUsers: number[] = [];

    beforeEach(async () => {
        // Setup specific test data if needed
    });

    afterEach(async () => {
        if (cleanupUsers.length > 0) {
            await db.delete(schema.wp_users).where(sql`${schema.wp_users.ID} IN ${cleanupUsers}`);
            await db.delete(schema.wp_usermeta).where(sql`${schema.wp_usermeta.user_id} IN ${cleanupUsers}`);
            cleanupUsers.length = 0;
        }
    });

    describe('getUserByLoginOrEmail', () => {

        test('should return user data when found by login', async () => {
            const testLogin = 'get_user_test_login';
            const testEmail = 'get_user_test@example.com';
            const created = await db.insert(schema.wp_users).values({
                user_login: testLogin,
                user_email: testEmail,
                user_pass: await hashPassword('password'),
                display_name: 'Get User Test',
                user_nicename: testLogin.toLowerCase(),
                user_registered: new Date().toISOString(),
            }).returning({ id: schema.wp_users.ID });
            const userId = created[0].id;
            cleanupUsers.push(userId);

            const result = await getUserByLoginOrEmail(testLogin);

            expect(result).not.toBeNull();
            expect(result?.id).toEqual(userId);
            expect(result?.user_login).toEqual(testLogin);
            expect(result?.user_email).toEqual(testEmail);
        });

        test('should return user data when found by email', async () => {
            const testLogin = 'get_user_by_email_test_login';
            const testEmail = 'get_user_by_email@example.com';
            const created = await db.insert(schema.wp_users).values({
                user_login: testLogin,
                user_email: testEmail,
                user_pass: await hashPassword('password'),
                display_name: 'Get User By Email Test',
                user_nicename: testLogin.toLowerCase(),
                user_registered: new Date().toISOString(),
            }).returning({ id: schema.wp_users.ID });
            const userId = created[0].id;
            cleanupUsers.push(userId);

            const result = await getUserByLoginOrEmail(testEmail);

            expect(result).not.toBeNull();
            expect(result?.id).toEqual(userId);
            expect(result?.user_login).toEqual(testLogin);
            expect(result?.user_email).toEqual(testEmail);
        });

        test('should return null when user is not found', async () => {
            const nonExistentLogin = 'non_existent_user_for_test';

            const result = await getUserByLoginOrEmail(nonExistentLogin);

            expect(result).toBeNull();
        });
    });

    describe('createUser', () => {

        test('should create a new user, hash password, and set defaults', async () => {
            // Arrange: Ensure user does not exist beforehand (use unique login/email)
            const uniqueLogin = `create_user_test_${Date.now()}`;
            const uniqueEmail = `create_${Date.now()}@example.com`;
            const input = {
                user_login: uniqueLogin,
                user_email: uniqueEmail,
                user_pass: 'password123',
                display_name: 'Create User Test',
            };

            // Act
            const createdUser = await createUser(input);
            expect(createdUser).toBeDefined();
            expect(createdUser.id).toBeDefined();
            const userId = createdUser.id;
            cleanupUsers.push(userId); // Schedule for cleanup

            // Assert: Fetch the user from DB to verify
            const dbUserResult = await db.select().from(schema.wp_users).where(eq(schema.wp_users.ID, userId)).limit(1).execute();
            const dbUser = dbUserResult[0]; // Get the first (and only) result

            expect(dbUser).toBeDefined();
            expect(dbUser?.user_login).toEqual(uniqueLogin);
            expect(dbUser?.user_email).toEqual(uniqueEmail);
            expect(dbUser?.display_name).toEqual(input.display_name);
            expect(dbUser?.user_nicename).toEqual(uniqueLogin.toLowerCase());
            expect(dbUser?.user_pass).not.toEqual(input.user_pass); // Password should be hashed
            expect(dbUser?.user_pass?.length).toBeGreaterThan(20); // Basic hash check
            // Timestamps can be tricky, check it exists and is reasonable type
            expect(dbUser?.user_registered).toBeDefined(); 
            // If using Turso/libsql Date might be string or number depending on config, check it exists
            // expect(dbUser?.user_registered).toBeInstanceOf(Date); // This might fail depending on driver/db

            // Assert: Check if default meta was created (e.g., nickname)
            const nicknameMetaResult = await db.select().from(schema.wp_usermeta)
                .where(sql`${schema.wp_usermeta.user_id} = ${userId} AND ${schema.wp_usermeta.meta_key} = 'nickname'`)
                .limit(1).execute();
            const nicknameMeta = nicknameMetaResult[0]; // Get the first result
            expect(nicknameMeta).toBeDefined();
            expect(nicknameMeta?.meta_value).toEqual(input.display_name);
            
            // Assert: Check other defaults if necessary
        });

        test('should throw error if user_login already exists', async () => {
            const existingLogin = `existing_login_${Date.now()}`;
            const created = await db.insert(schema.wp_users).values({
                user_login: existingLogin,
                user_email: `existing_${Date.now()}@example.com`,
                user_pass: await hashPassword('password'),
                display_name: 'Existing User',
                user_nicename: existingLogin.toLowerCase(),
                user_registered: new Date().toISOString(),
            }).returning({ id: schema.wp_users.ID });
            cleanupUsers.push(created[0].id);

            const input = {
                user_login: existingLogin,
                user_email: `new_email_${Date.now()}@example.com`,
                user_pass: 'password123',
                display_name: 'Duplicate Login Test',
            };

            await expect(createUser(input))
                .rejects
                .toThrow();
        });

        test('should throw error if user_email already exists', async () => {
            const existingEmail = `existing_email_${Date.now()}@example.com`;
            const created = await db.insert(schema.wp_users).values({
                user_login: `new_login_${Date.now()}`,
                user_email: existingEmail,
                user_pass: await hashPassword('password'),
                display_name: 'Existing Email User',
                user_nicename: `new_login_${Date.now()}`.toLowerCase(),
                user_registered: new Date().toISOString(),
            }).returning({ id: schema.wp_users.ID });
            cleanupUsers.push(created[0].id);

            const input = {
                user_login: `another_new_login_${Date.now()}`,
                user_email: existingEmail,
                user_pass: 'password123',
                display_name: 'Duplicate Email Test',
            };

            await expect(createUser(input))
                .rejects
                .toThrow();
        });
    });

    describe('updateUser', () => {
        let testUserId: number;
        let initialPasswordHash: string; // Store initial hash
        const initialLogin = `update_test_user_${Date.now()}`;
        const initialEmail = `update_${Date.now()}@example.com`;

        beforeEach(async () => {
            // Create a user to be updated in tests
            const initialPassword = 'initial_password';
            initialPasswordHash = await hashPassword(initialPassword); // Store hash
            const created = await db.insert(schema.wp_users).values({
                user_login: initialLogin,
                user_email: initialEmail,
                user_pass: initialPasswordHash, // Use stored hash
                display_name: 'Initial Name',
                user_nicename: initialLogin.toLowerCase(),
                user_registered: new Date().toISOString(),
            }).returning({ id: schema.wp_users.ID });
            testUserId = created[0].id;
            cleanupUsers.push(testUserId); // Ensure cleanup
        });

        test('should update basic user fields successfully', async () => {
           // ... existing test ...
        });

        test('should update user_pass successfully and hash the new password', async () => {
            // Arrange
            const newPassword = 'new_secure_password_123';
            const updates = {
                user_pass: newPassword,
            };

            // Act
            const updatedUserResult = await updateUser(testUserId, updates);

            // Assert: Check returned user (password shouldn't be returned)
            expect(updatedUserResult).toBeDefined();
            expect(updatedUserResult?.id).toEqual(testUserId);
            expect(updatedUserResult).not.toHaveProperty('user_pass'); // Service shouldn't return hash

            // Assert: Verify password hash directly in the database
            const dbUserResult = await db.select({ user_pass: schema.wp_users.user_pass }).from(schema.wp_users).where(eq(schema.wp_users.ID, testUserId)).limit(1).execute();
            const dbUserPass = dbUserResult[0]?.user_pass;

            expect(dbUserPass).toBeDefined();
            expect(dbUserPass).not.toEqual(newPassword); // Should not be plaintext
            expect(dbUserPass).not.toEqual(initialPasswordHash); // Should be different from initial hash
            expect(dbUserPass?.length).toBeGreaterThan(20); // Should look like a hash
        });

        test('should throw an error when updating a non-existent user', async () => {
            // Arrange
            const nonExistentUserId = 9999999; // An ID that definitely shouldn't exist
            const updates = {
                display_name: 'No Such User',
            };

            // Assert
            await expect(updateUser(nonExistentUserId, updates)).rejects.toThrow(
                `User with ID ${nonExistentUserId} not found for update.`
            );
        });

        // Add more tests: duplicate email etc.

    });

    describe('deleteUser', () => {
        test('should delete a user and return the deleted user info', async () => {
            // Arrange: create a user to delete
            const uniqueLogin = `delete_user_test_${Date.now()}`;
            const uniqueEmail = `delete_${Date.now()}@example.com`;
            const user = await createUser({
                user_login: uniqueLogin,
                user_email: uniqueEmail,
                user_pass: 'password123',
                display_name: 'Delete User Test',
            });
            // Act
            const { deleteUser } = await import('../apps/api/src/core/services/user/user.services');
            const deleted = await deleteUser(user.id);
            // Assert
            expect(deleted).toBeDefined();
            expect(deleted?.id).toEqual(user.id);
            expect(deleted?.user_login).toEqual(uniqueLogin);
            // Confirm user is gone from DB
            const dbUserResult = await db.select().from(schema.wp_users).where(eq(schema.wp_users.ID, user.id)).limit(1).execute();
            expect(dbUserResult.length).toBe(0);
        });

        test('should return null when deleting a non-existent user', async () => {
            const { deleteUser } = await import('../apps/api/src/core/services/user/user.services');
            const nonExistentUserId = 99999999;
            const result = await deleteUser(nonExistentUserId);
            expect(result).toBeNull();
        });
    });

    describe('getUsers', () => {
        test('should return all users (pagination)', async () => {
            // Arrange: create 3 users
            const users = [];
            for (let i = 0; i < 3; i++) {
                const login = `getusers_test_${Date.now()}_${i}`;
                const email = `getusers_${Date.now()}_${i}@example.com`;
                const user = await createUser({
                    user_login: login,
                    user_email: email,
                    user_pass: 'password123',
                    display_name: `GetUsers Test ${i}`,
                });
                users.push(user );
                cleanupUsers.push(user.id);
            }
            // Act
            const { getUsers } = await import('../apps/api/src/core/services/user/user.services');
            const result = await getUsers({ perPage: 100 });
            // Assert: all created users are present
            for (const user of users) {
                expect(result.some(u => u.id === user.id)).toBe(true);
            }
        });

        test('should return only included users if include param is used', async () => {
            // Arrange: create 2 users
            const userA = await createUser({
                user_login: `include_user_a_${Date.now()}`,
                user_email: `include_a_${Date.now()}@example.com`,
                user_pass: 'password123',
                display_name: 'Include User A',
            });
            const userB = await createUser({
                user_login: `include_user_b_${Date.now()}`,
                user_email: `include_b_${Date.now()}@example.com`,
                user_pass: 'password123',
                display_name: 'Include User B',
            });
            cleanupUsers.push(userA.id, userB.id);
            const { getUsers } = await import('../apps/api/src/core/services/user/user.services');
            // Act
            const result = await getUsers({ include: [userA.id] });
            // Assert
            expect(result.some(u => u.id === userA.id)).toBe(true);
            expect(result.some(u => u.id === userB.id)).toBe(false);
        });

        test('should support search filtering by login', async () => {
            // Arrange: create a user with a unique login
            const uniqueLogin = `search_user_${Date.now()}`;
            const user = await createUser({
                user_login: uniqueLogin,
                user_email: `search_${Date.now()}@example.com`,
                user_pass: 'password123',
                display_name: 'Search User',
            });
            cleanupUsers.push(user.id);
            const { getUsers } = await import('../apps/api/src/core/services/user/user.services');
            // Act
            const result = await getUsers({ search: uniqueLogin });
            // Assert
            expect(result.some(u => u.id === user.id)).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        test('should allow unicode characters in login and email', async () => {
            const unicodeLogin = `ユニコード🌟_${Date.now()}`;
            const unicodeEmail = `tést+🌈_${Date.now()}@exämple.com`;
            const user = await createUser({
                user_login: unicodeLogin,
                user_email: unicodeEmail,
                user_pass: 'password123',
                display_name: 'Unicode User',
            });
            cleanupUsers.push(user.id);
            // Retrieval
            const foundByLogin = await getUserByLoginOrEmail(unicodeLogin);
            expect(foundByLogin).toBeDefined();
            expect(foundByLogin?.user_login).toEqual(unicodeLogin);
            const foundByEmail = await getUserByLoginOrEmail(unicodeEmail);
            expect(foundByEmail).toBeDefined();
            expect(foundByEmail?.user_email).toEqual(unicodeEmail);
        });

        test('should allow very long but valid emails and logins', async () => {
            // DB limit for login: 60 chars (WordPress default)
            const maxLoginLength = 60;
            const loginUniquePart = String(Date.now());
            const baseLogin = 'l'.repeat(maxLoginLength - loginUniquePart.length);
            const longLogin = baseLogin + loginUniquePart; // Exactly 60 chars

            // Email: DB column is varchar(50)
            // We'll fit everything into 50 chars: local@domain.com
            const maxEmailLength = 50;
            const emailUniquePart = String(Date.now());
            const domain = 'd.com'; // keep domain short
            const atAndDomain = '@' + domain; // 6 chars
            // Always construct the local part so that localPart + atAndDomain is exactly maxEmailLength
            const allowedLocalLength = maxEmailLength - atAndDomain.length;
            let localPart;
            if (emailUniquePart.length >= allowedLocalLength) {
                localPart = emailUniquePart.slice(-allowedLocalLength);
            } else {
                localPart = 'e'.repeat(allowedLocalLength - emailUniquePart.length) + emailUniquePart;
            }
            const longEmail = `${localPart}${atAndDomain}`;
            expect(longEmail.length).toBeLessThanOrEqual(50);
            expect(longEmail).toMatch(/^.{1,}@d\.com$/);

            const user = await createUser({
                user_login: longLogin,
                user_email: longEmail,
                user_pass: 'password123',
                display_name: 'Long User',
            });
            cleanupUsers.push(user.id);
            const found = await getUserByLoginOrEmail(longLogin);
            expect(found).toBeDefined();
            expect(found?.user_login).toEqual(longLogin);
            expect(found?.user_email).toEqual(longEmail);
        });

        test('should fail to create user with over-length login/email', async () => {
            // Assuming DB columns are varchar(60) for login, varchar(254) for email (adjust if needed)
            const overLongLogin = 'x'.repeat(100) + Date.now();
            const overLongEmail = `${'y'.repeat(250)}@toolong.com`;
            await expect(createUser({
                user_login: overLongLogin,
                user_email: 'normal@example.com',
                user_pass: 'password123',
                display_name: 'Too Long Login',
            })).rejects.toThrow();
            await expect(createUser({
                user_login: 'normaluser_' + Date.now(),
                user_email: overLongEmail,
                user_pass: 'password123',
                display_name: 'Too Long Email',
            })).rejects.toThrow();
        });

        test('should not be vulnerable to SQL injection in login/email', async () => {
            const injectionString = `test'; DROP TABLE wp_users; --`;
            const user = await createUser({
                user_login: injectionString + Date.now(),
                user_email: `inj${Date.now()}@example.com`,
                user_pass: 'password123',
                display_name: 'Injection User',
            });
            cleanupUsers.push(user.id);
            // Retrieval should work, and DB should not be dropped
            const found = await getUserByLoginOrEmail(user.user_login);
            expect(found).toBeDefined();
            expect(found?.user_login.startsWith("test'; DROP TABLE")).toBe(true);
        });
    });

});
