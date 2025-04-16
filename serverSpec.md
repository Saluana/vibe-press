Perfect. I’ll create a comprehensive, high-performance server-side specification for AstroPress—your modern WordPress-compatible CMS—built on Bun and Express. It will cover:

- Full REST API compatibility with WordPress
- WPGraphQL-compatible schema
- Plugin system, auth, database schema, media handling
- Performance strategies, and optional OAuth via GitHub/Google

This will be a deep and detailed blueprint using the full 33,000-token limit, focusing entirely on server-side architecture.

I’ll let you know when it’s ready.

# AstroPress Server Architecture Specification

## Introduction

AstroPress is a modern reimplementation of the WordPress backend, designed to be a **robust, high-performance server-side platform**. It replicates WordPress’s functionality and data structures on a modern stack (Bun + Express + PostgreSQL), providing full compatibility with the WordPress REST API and an optional WPGraphQL schema. This specification describes AstroPress’s **server-side architecture** in detail – every major subsystem, its purpose, responsibilities, interfaces, and interactions – aimed at developers and system architects. The focus is purely on backend logic (no client-side code or UI), outlining how AstroPress will deliver a WordPress-equivalent experience through modern technology.

**Key Goals and Features:**

- **Complete WordPress API parity:** AstroPress exposes a REST API matching WordPress (1:1 routes and JSON response shapes) so existing tools and clients can interact seamlessly. Optionally, it also offers a GraphQL API compatible with the WPGraphQL plugin schema for more flexible queries.
- **Modern Stack Benefits:** Built on Bun (a high-performance JavaScript runtime) and Express (a proven web framework), AstroPress benefits from improved speed, efficient I/O, and modern development workflows, while preserving WordPress’s behavior.
- **PostgreSQL Database:** All WordPress-equivalent data (posts, pages, users, comments, terms, metadata, etc.) is stored in PostgreSQL, taking advantage of its reliability and performance features. The data schema mirrors WordPress so content and relationships remain consistent.
- **Extensible and Secure:** The architecture includes a robust authentication/authorization system with WordPress-style user roles and capabilities, support for password auth and optional OAuth login, and a plugin system for extending functionality (hooking into REST/GraphQL APIs, database actions, and content filters) similar to WordPress’s plugins.
- **Media Handling and Admin Tools:** A media file management system is included (local filesystem by default, with optional S3 integration) along with admin-only endpoints for managing plugins and themes (upload, activate, deactivate, etc.), providing parity with WordPress’s admin capabilities in a headless context.
- **Performance Optimization:** AstroPress is designed with performance in mind – query caching (in-memory or Redis), efficient pagination and data loading, and proper indexing – to outperform a typical WordPress/PHP setup while maintaining the same output and behavior for clients.

This document is organized by subsystem. Each section will detail the **purpose** of the component, its **responsibilities**, exposed **interfaces/APIs**, how it interacts with the **database** and other components, available **extensibility hooks**, and relevant **performance considerations**. Together these sections define a comprehensive technical specification for the AstroPress server-side architecture – essentially, how to build the most robust, WordPress-compatible backend ever, using modern tools.

## High-Level Architecture

AstroPress’s server is structured in a modular way, with clear separation of concerns between the web/API layer, the business logic and data layer, and the extensibility layer. At a high level, incoming HTTP requests (REST or GraphQL) are handled by Express routes or middleware, which invoke core services (for content, users, etc.) that interact with the PostgreSQL database and other subsystems (authentication, plugins, caching, etc.). The design emphasizes **modularity** (each subsystem encapsulates specific WordPress-like functionality) and **extensibility** (plugins can hook into defined points).

**Core Technology Stack:**

- **Bun Runtime:** AstroPress runs on Bun, a modern JavaScript runtime that uses the JavaScriptCore engine. Bun provides faster startup and execution than Node.js in many cases and efficient bundling of code. It fully supports Node APIs, so popular libraries like Express and pg (PostgreSQL client) work seamlessly. Bun’s performance characteristics (high I/O throughput, optimized JIT) help AstroPress handle concurrent requests efficiently.
- **Express Framework:** The server uses Express.js for HTTP request handling. Express provides a robust routing system and middleware pattern ideal for implementing the numerous REST API endpoints of WordPress. Each WordPress REST route is mapped to an Express route handler. Express’s middleware is also used for cross-cutting concerns (authentication, logging, error handling, etc.). The choice of Express ensures familiar structure and easy maintainability.
- **PostgreSQL Database:** All persistent data is stored in a PostgreSQL database. PostgreSQL is chosen for its reliability, strong ACID compliance, advanced features (JSON support, indexing options), and scalability. The schema closely follows WordPress’s MySQL schema (tables for posts, users, comments, etc., with equivalent fields), enabling data parity. A data access layer or ORM (e.g., using node-postgres or an ORM like Prisma/TypeORM) is used to interact with the DB, abstracting SQL queries and handling connections.
- **Modular Services:** AstroPress is organized into service modules (content service, user service, comment service, etc.), each responsible for a specific domain of data and logic. These services correspond to WordPress concepts (e.g., “Posts Service” analogous to WP’s posts.php functionality). They encapsulate business rules (like ensuring a draft post can only be read by its author, or updating counts when a comment is added) and interact with the DB via the data layer.
- **API Layer (REST & GraphQL):** On top of the services sits the API layer. The REST API module defines Express routes under `/wp-json/wp/v2/...` matching WordPress endpoints and uses the services to fulfill requests, then formats output to match WordPress JSON. The GraphQL API (if enabled) exposes a `/graphql` endpoint implementing the WPGraphQL schema, using the same services under the hood for data fetching. Both API layers enforce authentication and authorization rules via shared middleware.
- **Authentication & Authorization:** A centralized auth system verifies users and enforces permissions. It supports traditional WordPress username/password login (with secure hash storage) and can integrate OAuth providers (GitHub, Google, etc.) if configured. Once authenticated, requests carry a token or session indicating the user, and role/capability checks are performed for protected actions. The roles and capabilities mirror WordPress’s (Administrator, Editor, Author, etc., with capabilities like `publish_posts`, `edit_posts`, etc. ([Roles and Capabilities – Documentation – WordPress.org](https://wordpress.org/documentation/article/roles-and-capabilities/#:~:text=WordPress%20has%20six%20pre,functions)) ([Roles and Capabilities – Documentation – WordPress.org](https://wordpress.org/documentation/article/roles-and-capabilities/#:~:text=,can%20write%20and%20manage%20their))).
- **Plugin System:** AstroPress offers a plugin architecture analogous to WordPress’s. A Plugin Manager loads plugin modules (written in JavaScript/TypeScript) which can register hooks. Hook points are provided in the API layer (to add routes or fields), in content processing (to filter content or metadata), and in the data layer (to react to events like “post saved” or “user created”). Admin endpoints allow installing and managing these plugins. This system makes AstroPress **extensible**, enabling third-party developers to add features without modifying core.
- **Media Management:** The media subsystem handles file uploads and media data (images, videos, etc.). It stores media metadata in the database (as “attachment” posts, similar to WordPress) and the files on the server’s filesystem by default. It also supports alternative storage (like Amazon S3) via a storage interface – administrators can configure an S3 bucket, and the media system will store and serve files from S3 instead of local disk. This subsystem ensures parity with WordPress’s media handling (including generating URLs, metadata like image dimensions, etc.).
- **Admin Tools:** Certain operations, like installing a new theme or plugin, activating or deactivating them, etc., are restricted to administrators. AstroPress provides admin-only REST endpoints (under, for example, `/wp-json/astropress/v1/...`) to perform these tasks. These endpoints allow an external admin UI (or CLI tool) to manage the AstroPress installation in ways that WordPress’s wp-admin interface would – e.g., uploading a plugin ZIP, activating a theme, etc. The admin routes tie into the plugin system (for plugin activation) and potentially a theme manager.
- **Performance & Caching:** To achieve superior performance, AstroPress employs caching and optimization strategies at multiple levels. Frequently accessed data and expensive queries can be cached in memory or an external cache (Redis) to avoid repeated DB hits ([WordPress REST API · WordPress VIP Documentation](https://docs.wpvip.com/wordpress-on-vip/wordpress-rest-api/#:~:text=Caching)). The system uses **smart pagination** techniques and **batch data loading** to handle large datasets efficiently (especially in GraphQL). Database schema and queries are optimized with appropriate indexes and careful normalization/denormalization (reflecting WordPress’s approach of balancing normalized data with certain pre-computed fields like counts). We’ll detail these techniques in the respective sections, ensuring AstroPress is highly performant at scale.

All these components work together to deliver a **fully WordPress-compatible backend**. From an external perspective, a developer could point a WordPress REST API client or GraphQL query tool at AstroPress and see no difference in functionality or data structures, except faster responses and greater scalability. Internally, however, AstroPress is a reimagined engine – leveraging modern tech to overcome many limitations of the legacy PHP WordPress implementation.

The following sections break down each major subsystem in detail, including how they correspond to WordPress behavior and how they improve upon it.

## Data Model and Database Schema

At the heart of AstroPress is the data model, which mirrors WordPress’s content structure. Maintaining a similar schema ensures 1:1 mapping of concepts (posts, users, comments, etc.) and facilitates reuse of WordPress conventions. The database is PostgreSQL, but the schema uses equivalent tables and relationships to the WordPress MySQL schema (with some modernization where appropriate). **Every piece of WordPress data has a place in AstroPress’s database.** 

 ([The Ultimate Developer's Guide to the WordPress Database](https://deliciousbrains.com/tour-wordpress-database/)) *Figure: WordPress core database tables and their relationships (AstroPress uses an analogous schema) — wp_posts links to wp_users for author, wp_comments to wp_posts, etc. All meta tables store key–value pairs for extensibility.* ([The Ultimate Developer's Guide to the WordPress Database](https://deliciousbrains.com/tour-wordpress-database/#:~:text=Someone%20has%20produced%20a%20helpful,the%20structure%20is%20still%20current)) ([The Ultimate Developer's Guide to the WordPress Database](https://deliciousbrains.com/tour-wordpress-database/#:~:text=,wp_terms))

The major data structures in AstroPress include: **Posts (and Pages)**, **Users**, **Comments**, **Terms & Taxonomies**, **Media (Attachments)**, and **Metadata** (postmeta, usermeta, etc.), as well as a **Site Settings/Options** store. Each corresponds to a WordPress component:

- **Posts (and Pages):** Posts are the fundamental content unit (blog posts, articles) and Pages are a special type of post (hierarchical content). In the database, there is a `posts` table (like `wp_posts` in WordPress) that stores both posts and pages (and other post types) distinguished by a `post_type` column. Each row includes fields analogous to WordPress:
  - **Identification:** `ID` (primary key) and `guid` (a global unique identifier URL, similar to WordPress’s GUID). 
  - **Content Fields:** `post_title`, `post_content`, `post_excerpt` for the main content. `post_status` (publish, draft, etc.), `post_date` (and `post_date_gmt` for UTC time) for publication timing.
  - **Post Type and Hierarchy:** `post_type` (e.g., “post”, “page”, “attachment”), `post_name` (slug), `post_parent` (for hierarchical relationships, used by pages or attachments).
  - **Metadata Pointers:** A `comment_count` and `comment_status` (open/closed) for comments, and fields for ping status and password protection (e.g., `post_password` for protected posts).
  - **Relationships:** `post_author` (foreign key to the users table for the author). In AstroPress, we enforce referential integrity here (with an FK constraint linking to a `users.id`), something WordPress doesn’t do at the DB level but we can safely implement given our single-DB control.
  - **Revisions:** AstroPress can optionally support revisions of content: if enabled, revisions are stored as separate entries in the same table with `post_type = 'revision'` and a `post_parent` linking to the main post, similar to WordPress’s revision system. This allows draft edits and content history.

  **Responsibilities & Behavior:** The Posts table holds not just blog posts but any custom post type entries as well (should AstroPress allow custom post types via plugins). The system ensures that querying posts (via REST or GraphQL) filters by `post_type` appropriately (e.g., the REST “posts” endpoint only returns `post_type='post'`, the “pages” endpoint returns `post_type='page'`, etc.). When a post is published or updated, AstroPress triggers any hooks (e.g., a “post_saved” event for plugins, updating search index or caches, etc.), and if a post’s status changes (draft→publish) it may clear relevant caches. The schema is normalized (post content is separate from metadata or term relations) but also **denormalized in places to mirror WP’s behavior** – for example, storing `comment_count` in the post row to avoid expensive comment counts on each page load, just as WordPress does (updated via triggers when comments change).

  **Indexing & Performance:** Key columns like `post_type`, `post_date`, and `post_author` are indexed to fast-track common queries (listing posts by date, author archives, etc.). Slug (`post_name`) is indexed (unique per post type) to allow quick lookups by slug (used in REST URL and GraphQL queries). The combination of (`post_type`, `post_status`) could be indexed to quickly fetch published posts of a certain type, etc. These indexes align with WordPress’s usage patterns. PostgreSQL’s support for indexes on text and use of `GIN` indexes for full-text search can be utilized if implementing search (WordPress uses a separate search algorithm; AstroPress could optionally use PG’s full text to speed up search queries while returning results identical to WP’s expectations).

- **Users and Roles:** The `users` table (like `wp_users`) stores registered user accounts. Fields include:
  - `ID` (primary key), `user_login` (username), `user_email`, `user_registered` (timestamp), `user_status` (generally unused in WP but exists), and `display_name` (the name to display publicly).
  - `user_pass` which will store the **hashed password**. AstroPress uses a strong hashing algorithm (e.g., bcrypt or Argon2) with salting to securely store passwords – an improvement over older WP MD5-based schemes, while maintaining the ability to verify a password login.
  - Other fields: `user_nicename` (URL-friendly name), `user_url` (website URL if provided).
  
  In WordPress, user roles and capabilities are not stored in the `wp_users` table directly; instead, a user’s role(s) is stored in `wp_usermeta` (as a serialized array for roles and capabilities). In AstroPress, we implement an **explicit Role management schema** for clarity and security:
  - A `roles` table lists all defined roles (like Administrator, Editor, etc.) and their associated capabilities (this could be a JSON field or a separate join table `role_capabilities`).
  - A join table `user_roles` maps users to one or more roles (for single-site WordPress, typically one primary role per user, but storing as a relation allows flexibility and multiple roles if needed, as WordPress technically allows multiple roles via plugins).
  - This schema means we don’t rely solely on a meta field for roles; however, for WordPress parity, AstroPress will still expose user roles in the same way (e.g., in REST API, the User object might include a `roles` array of strings as WordPress does).
  
  **Responsibilities:** The Users system handles authentication (verifying `user_pass` on login), password resets, and tracks user profile info. It must enforce WordPress’s role/capability rules throughout the system. For instance, when a user attempts to update a post via the API, the system checks the user’s capabilities (derived from their role) to decide if that operation is allowed (e.g., an Editor can edit others’ posts, an Author can only edit their own posts, etc., matching WordPress rules ([Roles and Capabilities – Documentation – WordPress.org](https://wordpress.org/documentation/article/roles-and-capabilities/#:~:text=,can%20only%20manage%20their%20profile))). The roles and capabilities are by default the standard WordPress ones: Administrator (full access), Editor (edit any content), Author (publish own content), Contributor (write but an admin/editor must publish), Subscriber (read/comment, minimal access) ([Roles and Capabilities – Documentation – WordPress.org](https://wordpress.org/documentation/article/roles-and-capabilities/#:~:text=,can%20write%20and%20manage%20their)). These defaults can be extended via plugin (the plugin system could call an API to add a new role or capability, similar to `add_role()` in WP).
  
  **Database interactions:** When a new user registers (or is created by an admin), an entry is added to `users` and a corresponding role assignment is made (if no specific role given, AstroPress will default to a configurable default role, e.g., Subscriber, like WP does). The `user_meta` table (discussed later) stores additional data like first/last name, description, or plugin-specific settings for a user.
  
  **Security & Performance:** All password operations use safe hashing. On login, the provided password is hashed and compared to `user_pass`. We may use Bun’s efficient crypto for this. To prevent timing attacks, comparisons are constant-time. We also implement measures like login rate limiting or brute-force protection (e.g., via a plugin or built-in throttle after X failed attempts) – not strictly part of WP core, but a worthwhile addition for a “most secure” backend. In terms of performance, user lookups by ID are straightforward (primary key). Lookups by username or email will be indexed (we can add unique indexes on `user_login` and `user_email` since WP does so for user_login and uses user_email for password reset lookup). For roles and capabilities, queries will typically fetch a user’s roles via a join or cached after authentication (we might cache user role info in memory or as a signed token payload to avoid frequent DB hits on each request).

- **Comments:** The `comments` table (like `wp_comments`) stores comments on posts. Each comment row includes:
  - `comment_ID` (PK), `comment_post_ID` (foreign key to posts table, indicating which post/page the comment is on).
  - `comment_author`, `comment_author_email`, `comment_author_url`, `comment_author_IP` – the author’s name and contact info. These are used for guest comments; for registered-user comments, WordPress also stores the user ID.
  - `user_id` field (foreign key to users, if the comment author was a logged-in user when commenting).
  - `comment_date` and `comment_date_gmt`, `comment_content` (the text of the comment), `comment_approved` (approval status: 0,1 or spam flag etc.), `comment_parent` (for threaded comments, points to another comment ID), and `comment_type` (usually empty for normal comments, could indicate “pingback” or “trackback”).
  
  **Responsibilities:** The Comments system manages commenting functionality – retrieving comments for display via API, handling new comment submissions, and enforcing moderation rules. Like WordPress, AstroPress supports nested replies (threaded comments) up to a configurable depth. The `comment_parent` field is used to nest comments. On retrieving comments via REST, they will be returned in hierarchical form or with parent references as WordPress does (the WP REST API includes `parent` field and the client can build threads; AstroPress could also offer pre-threaded output if needed for convenience, but by default, mimic WP output). The `comment_approved` field indicates if a comment is public (`1`), pending (`0`), or marked spam (`spam` in WP convention or perhaps a numeric code). AstroPress will mimic WP’s logic: by default, comments by new authors or those containing certain keywords may require approval – this logic can be implemented in the Comments service or via a plugin hook for custom moderation.
  
  **Interactions and Data Updates:** When a new comment is added via API:
  - The Comments service writes a new row to `comments`. If the comment is auto-approved (e.g., by an admin or if the site is configured to allow immediate publish), `comment_approved` is set to 1 and the comment becomes immediately available via API. If it requires moderation, `comment_approved` is 0 and the comment will not appear in normal queries (unless a query by an admin includes all statuses).
  - The `posts.comment_count` for the related post is incremented (just as WordPress does). AstroPress ensures this consistency, likely by an internal function or trigger: after inserting a comment row, the Posts service increments the associated post’s comment_count if the comment is approved. If a comment’s status changes (approved later by an admin), we increment then; if a comment is deleted or marked spam, we decrement the count. This mirrors WP behavior where comment_count is used for quick counts.
  - An email notification hook (like WordPress’s notify post author of new comment) can be implemented via the plugin system listening on a “comment_posted” event. AstroPress core could include a simple plugin for this or leave it to external plugin to handle notifications, but it will provide the hook and necessary data.
  
  **Performance:** Comments are indexed by post (we have an index on `comment_post_ID` to quickly fetch all comments for a given post) and by other relevant fields (maybe an index on `comment_approved` and post for fetching only approved comments quickly, since typically front-end only shows approved ones). For listing all recent comments or moderating, an index on date could help. The number of comments per post can be large, so the system should support pagination on comments endpoints. WordPress REST API paginates comments if needed; AstroPress will do similarly (ensuring the same default page size and structure). We also consider caching frequent comment lookups, e.g., the first page of comments for a popular post could be cached in memory for quick retrieval, invalidated when a new comment comes in.

- **Terms and Taxonomies:** WordPress organizes content via a system of **Terms** (items like categories, tags, or any taxonomy terms) and **Taxonomies** (groupings of terms). AstroPress will have equivalent tables:
  - `terms` table (like `wp_terms`): columns `term_id`, `name` (the human-readable term name), `slug` (URL-friendly slug), and perhaps `term_group` (an rarely used WP field for grouping terms).
  - `term_taxonomy` table (like `wp_term_taxonomy`): columns `term_taxonomy_id`, `term_id` (FK to terms), `taxonomy` (e.g., “category” or “post_tag”), `description`, `parent` (for hierarchical taxonomies like categories), and `count` (number of posts associated with this term).
  - `term_relationships` table: links a term_taxonomy entry to a post. Columns: `object_id` (which in our case is a post ID), `term_taxonomy_id` (FK to term_taxonomy), and maybe a term order (WordPress has an order field for ordering terms per object, rarely used).
  - Additionally, WordPress in recent versions has a `termmeta` table for term metadata; AstroPress can include a `term_meta` table to allow storing arbitrary meta for terms if needed (similar structure: meta_id, term_id, key, value).
  
  **Responsibilities:** The Terms & Taxonomy system lets content be categorized and tagged. In AstroPress:
  - It will come with the built-in taxonomies “category” (hierarchical) and “post_tag” (non-hierarchical) to match WordPress defaults for blog posts. Pages by default are uncategorized (like WP).
  - Posts service, when publishing or updating a post, can assign terms by writing entries to `term_relationships`. For example, if a post is given category IDs [2,5], the system will ensure there are entries mapping that post’s ID to term_taxonomy 2 and 5. Similarly for tags.
  - The `count` field in term_taxonomy is maintained (WordPress updates the count whenever posts are added or removed from a term). AstroPress will likewise update the count field (e.g., increment when a post is associated with a term, decrement on removal or post deletion). This provides quick access to how many posts a category has, etc., without doing a COUNT query each time.
  - Term hierarchy (like parent/child categories) is preserved via the `parent` field. The REST API will output hierarchical taxonomies accordingly (e.g., categories in a tree structure or with parent field).
  
  **Interfaces:** There will be REST endpoints for terms and taxonomies (WordPress has `/wp-json/wp/v2/categories`, `/tags`, and also `/wp/v2/taxonomies` for taxonomy definitions). AstroPress’s Term service provides functions to get terms by taxonomy, to add a term, etc., and these tie into the REST/GraphQL. For example, a GET `/categories` will fetch all terms where taxonomy = category from the DB, sort by name or id as WP does, and return JSON including fields like id, name, slug, description, count, parent. Creating a term via POST is allowed for authorized users (e.g., Editor can create a category) – AstroPress will insert into terms and term_taxonomy and return the new term object.
  
  **Extensibility:** Custom taxonomies can be registered by plugins (just like WP allows `register_taxonomy`). The plugin system will interact with the Terms service to add new taxonomy types (which might involve creating entries in an in-memory registry and ensuring the REST API knows about new routes for them). For example, a plugin could add a “Genre” taxonomy for posts. AstroPress would then allow GET/POST on `/wp-json/wp/v2/genres` etc. The data layer is generic enough because the tables store any taxonomy. The GraphQL schema would also need to be extended to include new taxonomy types if GraphQL is enabled (this is handled by the extensibility system as well).
  
  **Performance:** Terms queries are generally straightforward (small tables relative to posts). Primary keys and foreign keys are indexed (e.g., index on term_id in term_taxonomy, and on term_taxonomy_id in term_relationships, plus a composite index on object_id + term_taxonomy_id for quick lookups of terms for a given post and vice versa). This ensures retrieving a post’s terms (join through term_relationships) is fast, and listing posts by a term is also fast via that join and index. For very large number of terms or relationships, these queries might become heavy – AstroPress can cache popular term queries (e.g., list of tags used on a very large site) in memory or utilize the count to short-circuit some operations (WordPress uses the count to decide if it needs to query term_relationships in some cases). We will also ensure slug fields are indexed for terms to quickly handle queries by slug (common when resolving by name).

- **Media (Attachments):** Media files (images, videos, docs) are treated in WordPress as a type of post (post_type = ‘attachment’). AstroPress follows this model for data consistency:
  - An uploaded file gets an entry in the `posts` table with `post_type = 'attachment'`. Key fields: `guid` often stores the file URL, `post_mime_type` (for the file type, e.g., “image/jpeg”), `post_title` (usually the file name or title), and `post_content` might hold a description or empty, `post_excerpt` might hold the caption. `post_parent` can link to another post if the media was uploaded “to” a specific post (i.e., attached to that post).
  - The actual file path or URL is stored in such a way to retrieve the file. In WordPress, the `guid` is often the full URL to the file, and additional metadata like different image sizes is stored in postmeta (`_wp_attachment_metadata` meta key holds a serialized array of sizes, etc.). AstroPress will similarly have a `post_meta` entry for attachments that includes metadata (like width/height for images, maybe a JSON structure since we can store JSON in PostgreSQL).
  - The `post_author` of attachment could be the uploader’s user ID.
  
  **Responsibilities:** The Media subsystem’s job is to handle file uploads, storage, and retrieval. When a user (with permission) hits the media upload endpoint (similar to WP’s `/wp-json/wp/v2/media` with a POST containing a file), AstroPress will:
  - Verify the user’s permission (e.g., by default, Author and above can upload files in WordPress).
  - Accept the file (likely using an Express middleware for file uploads, e.g., handling multipart form data).
  - Store the file in the configured storage: by default, this is the local filesystem. AstroPress would have a configured `uploads` directory (e.g., `wp-content/uploads` equivalent) possibly structured by year/month (like WordPress does) to avoid too many files in one folder. The storage module saves the file and returns its path or URL.
  - Create a database entry in `posts` for the attachment with appropriate fields (title = filename, mime type, author, etc.), and add relevant meta (like `_wp_attachment_metadata` with JSON including file sizes if the system generates thumbnails, `_wp_attached_file` meta with the relative file path).
  - Respond via the REST API with the media item’s data (WordPress returns a JSON object for the uploaded media, including an `id`, the URL, etc.).
  
  AstroPress’s media management also includes serving the media: for local files, the web server (Express) might serve static files from the uploads directory for requests to the file URL. Alternatively, the media URLs might point directly to a static domain or S3. If using S3, the system will upload the file to S3 instead of local disk and store the S3 URL (or key info) in the attachment’s data. The Media subsystem abstracts these differences so the rest of the system doesn’t need to know where files are – it just knows the URL or path to present.
  
  **Interfaces:** 
  - **REST API:** `/wp-json/wp/v2/media` for listing media and posting new media. Also GET `/media/{id}` to retrieve a media item’s info, DELETE to delete a media item (which would remove the DB entry and possibly the file from storage). The response must match WP shape, e.g., including `source_url`, `media_details` (with sizes for images), etc.
  - **GraphQL:** The GraphQL schema (if enabled) provides a type for MediaItem or Attachment with fields like sourceUrl, mediaType, etc., similar to WPGraphQL’s Media type. Queries for a post in GraphQL can include its featured image with fields like `featuredImage { node { sourceUrl, mediaDetails { sizes { ... } } } }`, and AstroPress should provide those by pulling from the stored metadata.
  
  **Extensibility:** Plugins can hook into the media process. For example, a plugin could perform image optimization on upload or virus scan on files. AstroPress will have a hook event “media_upload” or similar where plugin code could modify or reject the upload (like WordPress’s `wp_handle_upload` filter or others). Additionally, if using external storage providers beyond S3 (say Google Cloud Storage), a plugin could implement that by hooking into a storage interface registration. AstroPress’s storage interface for media can allow swapping out the backend – either via configuration (S3 or local) or via plugin for custom solutions.
  
  **Performance & Considerations:** Serving media can be bandwidth-intensive. AstroPress can integrate with CDN easily – if files are on S3 or even local, you might front them with a CDN. The media system’s concern is mainly metadata and correctness:
  - Ensure proper cleanup (if an attachment is deleted, remove the file if on local disk; if on S3, delete from bucket).
  - Generating image thumbnails could be done synchronously on upload (like WP does, creating multiple sizes) or offloaded to a worker process – AstroPress could use a background job for heavy image processing to keep the main thread snappy. For spec simplicity, assume synchronous but optimized (and mention that heavy operations could be deferred or scaled out).
  - Database wise, attachments are in the posts table so queries like listing all posts might include attachments unless filtered – we must always ensure queries filter `post_type` appropriately (e.g., listing posts should use `WHERE post_type='post'`, etc., or join with term_taxonomy when listing by category will naturally exclude attachments since those usually aren’t in categories).
  - Indexing on attachments: we might index `post_mime_type` if needed (e.g., to quickly find all images vs videos, though not common), and definitely index `post_parent` to find attachments attached to a given post (WordPress uses that to show media attached to a post).
  
- **Metadata (Post Meta, User Meta, etc.):** The meta tables store arbitrary key–value pairs associated with posts, users, comments, or terms. These are crucial for extensibility since both WordPress core and plugins use meta to store additional data (custom fields on posts, user profile extra info, etc.). AstroPress implements meta similarly:
  - `post_meta` table: columns `meta_id`, `post_id` (FK to posts), `meta_key`, `meta_value`.
  - `user_meta` table: `umeta_id`, `user_id` (FK to users), `meta_key`, `meta_value`.
  - `comment_meta` and `term_meta` likewise for comments and terms respectively (WordPress added termmeta in WP 4.4).
  
  **Responsibilities:** The meta system allows storing flexible data. For example, custom fields on a post (like “subtitle” or “mood”) would be entries in post_meta. WordPress core itself uses post_meta for certain features (the `_wp_attachment_metadata` mentioned, or `_thumbnail_id` meta on posts to indicate the featured image ID). AstroPress must preserve these conventions:
  - When a featured image is set for a post (via REST API or GraphQL mutation), AstroPress will add/update the `_thumbnail_id` meta key on that post with the attachment’s ID. The REST API when returning a post includes `featured_media` field (the ID of the featured image) and a `better featured image object is embedded via `_links` if requested). AstroPress will do the same: `featured_media` comes from that meta.
  - Options that were historically stored in meta are handled accordingly (though many site options go in the options table, not meta).
  
  **Data Access:** Accessing meta is typically done in conjunction with the main object. For performance, AstroPress might **join** the meta table when fetching data for an API response or use separate queries and then merge results. WordPress, in PHP, often loads meta in a separate call (not a join by default). We can do better by using SQL joins or at least batched queries. For example, when retrieving a post via REST, AstroPress could fetch the post row and also do a query for all post_meta for that post in one go, rather than waiting for code to individually request each meta key. Because we know WordPress endpoints often need certain meta (like `_wp_attachment_metadata` for media, or any registered custom REST fields that might live in meta), we can pre-fetch.
  
  **Storage:** `meta_value` can be various data types. In WordPress it’s a longtext field. AstroPress could use a text field or a **JSONB** type in PostgreSQL if we expect to store JSON data. But to maintain parity, we might keep it as text/varchar and just store JSON as string if needed. One improvement: if meta values are large (e.g., serialized arrays), using PostgreSQL’s JSONB could allow querying inside them. However, WordPress doesn’t expect us to query inside serialized meta often (except with meta_query which is usually key/value match, which PG can do on text too). We will keep meta simple but possibly add partial indexes (e.g., index on meta_key, and maybe index on (post_id, meta_key) for quick specific meta lookups).
  
  **Extensibility:** Plugins will heavily use meta to store settings or domain-specific data. AstroPress’s Plugin API will provide functions to add/get meta (just like WP’s `add_post_meta`, etc.), which under the hood perform DB operations. We ensure these are safe (use parameterized queries to avoid injection) and efficient (cache where appropriate). Also, the REST API is extensible to expose meta as part of the response if needed: WordPress by default does not expose all meta fields via REST unless registered as such for security reasons. AstroPress will follow that principle – only certain meta (like `_wp_attachment_metadata`, or plugin-allowed fields) are output. Developers can register additional meta exposure via our hook system (similar to `register_rest_field` in WP which can expose meta in the REST API).
  
  **Performance:** Meta queries can be a bottleneck if overused (WordPress sites with thousands of meta entries per post suffer slow queries). We mitigate this by:
  - Proper indexing: index the `meta_key` column (WordPress does index meta_key but with length limits in MySQL). PostgreSQL can index the full key. Also index `post_id` for post_meta to group lookups by post.
  - Caching: we can cache meta for frequently accessed objects. For instance, when loading a post, we might cache all its meta in a memory store so subsequent requests for the same post don’t hit the DB for meta. This is similar to WP’s object cache concept.
  - Perhaps providing alternative storage for structured data: If a plugin or core wants to store large structured info, consider using JSONB columns in a custom table instead of heavy meta usage. But that’s more of a plugin design choice. AstroPress core will not deviate from WP’s meta usage in order to remain compatible.

- **Options (Settings):** The `options` table (like `wp_options`) holds site-wide settings and configuration data, typically key-value pairs that are not tied to a single post/user. For example: site name, site URL, default settings, active plugins list, etc. AstroPress will have an `options` table with `option_name`, `option_value`, and possibly `autoload` flag (WordPress uses an `autoload` boolean to indicate if an option should be preloaded at startup – we can include this for parity).
  
  **Usage:** On boot, AstroPress can preload autoloaded options (like WordPress loads all options with autoload = yes into memory for efficiency). This could include crucial config like the active theme, plugin settings, etc. Non-autoload options can be fetched on demand via an Options service.
  
  **In AstroPress, options will also be used to store:** 
  - Active plugins list (so the Plugin Manager knows which plugins to load on startup – WP stores an array of plugin filenames in the `active_plugins` option).
  - Active theme (if relevant; WP stores `stylesheet` and `template` for theme info).
  - Any plugin-specific config that’s site-wide.
  - Possibly feature flags like “GraphQL enabled” could be stored here (or could be environment config – we’ll discuss config later).
  
  **Management:** The admin routes will allow updating certain options (like toggling maintenance mode or updating site title). The Options service will have to perform the update and possibly flush any relevant caches. 
  - For example, changing the active theme option would trigger the system to load the new theme’s configuration (in WP, that means change which template files are used – in AstroPress, it might not have an immediate effect without a front-end, but we keep the data).
  
  **Security:** Many options are sensitive (like API keys if any, though those might be better kept out of DB). We ensure only admin-level roles can read/write appropriate options via the API (just as WP protects options editing to admins). Some options (like `home` and `siteurl`) might not be exposed via REST at all to normal users.
  
  **Performance:** We minimize DB hits for options by caching them aggressively (WordPress loads autoload options into a global cache; we can do similarly in our initialization – e.g., fetch all autoload options once and store in memory or an in-memory cache that is consulted on each option get). Updates to options will update the DB and also update the in-memory cache to keep consistency.

In summary, AstroPress’s database component is designed to **faithfully represent WordPress data**. All the normalization and relationships of WordPress are present (with improvements such as explicit foreign keys and proper indexing). The system ensures that any data that would be present in a WordPress site (posts, associated metadata, user info, etc.) has an equivalent place and will be served through the APIs in the same format. This continuity enables compatibility while the improved relational integrity, indexing, and caching provide a **strong foundation for performance and scalability**.

## WordPress REST API Module (REST Interface)

One of AstroPress’s primary interfaces is the **WordPress REST API** compatibility module. This subsystem exposes HTTP endpoints under the path `/wp-json/wp/v2/` (and other namespaces as needed) that mirror exactly the endpoints of the WordPress REST API. The goal is that clients cannot tell they aren’t talking to a WordPress PHP backend – the URLs, HTTP methods, query parameters, and response JSON structures are all identical. This allows existing WordPress headless front-ends, mobile apps, or third-party tools that use WP REST API to work with AstroPress out-of-the-box.

### Purpose and Scope

- **Purpose:** Implement the full WordPress REST API (v2) on the AstroPress server. This means providing every standard route (for posts, pages, comments, terms, users, etc.) with the same semantics. It should handle retrieving content, creating/updating content (for authorized users), and deleting content, following WordPress’s rules and field formats. Essentially, the REST API module is the “public face” of AstroPress for any RESTful interactions.
- **Scope:** All core WordPress REST routes and maybe some additional admin routes (for AstroPress-specific management). The core routes include (non-exhaustive list):
  - **Posts**: `GET /wp-json/wp/v2/posts` (list posts, with filters like author, categories, search, pagination), `POST /wp-json/wp/v2/posts` (create post), `GET /wp-json/wp/v2/posts/{id}` (retrieve single), `PUT/PATCH /wp-json/wp/v2/posts/{id}` (update), `DELETE /wp-json/wp/v2/posts/{id}` (delete). Similarly for **Pages** (same pattern under `/pages` endpoint).
  - **Comments**: `GET /wp-json/wp/v2/comments`, `POST .../comments` (create new comment), etc.
  - **Taxonomies**: `GET /wp-json/wp/v2/categories`, `/tags`, etc., and their CRUD.
  - **Users**: `GET /wp-json/wp/v2/users` (list users, typically only for admins), `GET /users/{id}` (single user, with fields limited if not admin – WP only shows public fields unless authenticated as self or admin), `POST /users` (create user, maybe allowed for admin), etc.
  - **Media**: `GET /wp-json/wp/v2/media`, `POST /media` (upload), etc.
  - **Others**: **Post Revisions** (`/wp/v2/posts/{id}/revisions`), **Menus** (if WP nav menus are considered, but those are not core REST by default unless plugin), **Post Types** (`/wp/v2/types` for info on custom post types), **Taxonomies** definitions (`/wp/v2/taxonomies`), **Statuses** (`/wp/v2/statuses`), and **Settings** (`/wp/v2/settings` – an endpoint that WordPress exposes to manage some options via REST for authenticated administrators).
  
  AstroPress will implement these where relevant. For example, the `/settings` endpoint (if enabled) would tie into the Options system to allow reading/updating certain site options (like title, description) via REST (WordPress does this for the Gutenberg editor’s sake).

### Implementation Overview

AstroPress uses **Express.js** to define the REST routes. We will structure the routes using Express Router, grouping by resource type. For instance, a “posts router” defines the `/posts` routes, a “comments router” for `/comments`, etc., all mounted under the `/wp-json/wp/v2` path. Each route handler will call the corresponding AstroPress service (from the Data/Business layer described earlier) to perform the needed action. 

**Example**: a GET request to `/wp-json/wp/v2/posts?author=5&per_page=10&page=2` would be handled by the PostsRouter’s list handler:
- It would parse query parameters (author=5, pagination params).
- Call the Posts service’s method like `listPosts({ author:5, page:2, perPage:10 })`.
- That service method queries the DB (possibly via the Data layer or an ORM) to get the matching posts. It also likely fetches associated data needed (like author info, featured media, terms) to include in the response.
- The service returns a list of post objects (in an internal format, maybe as model instances or plain JS objects).
- The REST handler then formats these into the exact JSON structure WordPress uses: for each post, fields like `id`, `date`, `slug`, `status`, `title` (which itself is an object with `rendered` text as WP does), `content` (object with `rendered` HTML, maybe `protected` flag), `author` (just the author ID in the posts list context, but often the API also includes an `_embedded` object if _embed param is used), etc.
- It also sets the appropriate HTTP headers: WordPress sends `X-WP-Total` and `X-WP-TotalPages` headers on collection responses to indicate pagination totals. AstroPress will compute the total count and total pages (the Posts service can do a count query or use cached count) and set those headers to match ([WordPress REST API · WordPress VIP Documentation](https://docs.wpvip.com/wordpress-on-vip/wordpress-rest-api/#:~:text=Caching)). 
- The JSON is then sent to the client, ideally matching bit-for-bit what WP would send for the same request.

**Response Shape Parity:** Ensuring the JSON matches WordPress is crucial. This includes:
- **Field names and types:** e.g., the `date` field is in ISO8601 string, `title` is an object with a `rendered` field containing the HTML (with any WP filters like shortcodes applied), `excerpt.rendered`, etc. AstroPress will actually need to run content through WordPress-equivalent filters (like auto-formatting paragraphs, processing shortcodes, etc.) so that the rendered HTML in the REST API is the same as WordPress’s. We’ll handle content filters via the Plugin system (core can provide a shortcode filter plugin to emulate WP shortcodes).
- **Links and Embedding:** WordPress REST API includes a `_links` object in each resource, containing URLs for related resources (like self, collection, author, replies, etc.). AstroPress will construct the `_links` array accordingly for each resource. For example, for a post:
  - `_links.self.href` pointing to its own URL.
  - `_links.author.href` pointing to the author’s user API URL.
  - `_links.comments` pointing to its comments endpoint.
  - etc., exactly as WP does.
- Additionally, if the client uses the `_embed` query parameter, WP REST will embed related objects in the response (e.g., include the author object, featured media object inside the response under `_embedded`). AstroPress will support `_embed`. This means our handler might pre-fetch the author and media and include them. We must embed in the identical structure WP uses (e.g., `_embedded.author[0]` is the author object array).
- **Status codes and errors:** WordPress REST has specific error responses (usually status code 400 for bad requests with a JSON body containing `code`, `message`, and `data` with status). AstroPress will have a unified error handling middleware that catches errors thrown by handlers or service functions and maps them to these WP-style error responses. For example, if a post ID is not found, WP returns a 404 with `code: "rest_post_invalid_id"`. We can maintain a catalog of such error codes and messages to output the same. This attention to error shape ensures clients that expect WP error codes continue working (some clients inspect the `code` field in the error JSON).
- **Authentication flows:** WordPress REST normally uses cookie & nonce for web, or basic auth/ OAuth1 / JWT plugin for external. AstroPress by default may prefer token-based auth (as we’ll detail in Auth section), but for compatibility, it could accept a Basic Auth header (for application passwords, which WP supports in REST) or verify a token similarly to how WP’s optional JWT plugin works. We can also mimic the Application Passwords feature WP has (which allows creating base64 user-specific tokens) ([WordPress REST API · WordPress VIP Documentation](https://docs.wpvip.com/wordpress-on-vip/wordpress-rest-api/#:~:text=,the%20user%20making%20the%20request)). The key is that when no auth is provided, AstroPress serves public data (e.g., public posts, no private ones) and when auth is provided and the user has rights, it serves accordingly – matching WP’s behavior where the same endpoint yields more data for authorized users (e.g., showing draft posts to their authors or including private fields).
- **Context parameter:** WP REST uses `context` (view/edit) to control fields (edit context includes fields like `post_content_raw` and meta for authors). AstroPress will support `?context=edit` for authenticated users with permission, and include additional fields in the JSON (like raw content, raw title, etc.) as WP does. This is important for compatibility with things like the Gutenberg editor which fetch posts with context=edit to get raw data.

### Responsibilities and Workflow

The REST API module’s responsibilities include: **routing, input validation/sanitization, invoking business logic, and formatting output.** In more detail:

- **Routing & Dispatch:** Map each HTTP route to the correct handler function. We will ensure all documented WP REST routes are present. This also includes any custom routes needed for AstroPress admin features (e.g., plugin upload route), which might live in a different namespace (perhaps `/wp-json/astropress/v1/...`). But core content routes stay under `/wp/v2` to maintain 1:1 parity with WP’s namespace. 
- **Validation & Parsing:** For incoming data (POST/PUT requests), validate and sanitize inputs as WP would. For instance:
  - If creating a post, enforce required fields or valid values (status must be one of allowed statuses, date must be valid datetime, etc.). WP’s REST API has a schema for each endpoint that defines what fields it accepts and their types; AstroPress can similarly define schemas (could use a library like Ajv for JSON schema validation or manual checks following WP’s REST API Handbook specs ([Posts – REST API Handbook | Developer.WordPress.org](https://developer.wordpress.org/rest-api/reference/posts/#:~:text=,the%20author%20of%20the%20post)) ([Posts – REST API Handbook | Developer.WordPress.org](https://developer.wordpress.org/rest-api/reference/posts/#:~:text=,post%20in%20the%20category%20taxonomy))).
  - If a field is invalid, return the same error code WP would (e.g., "rest_invalid_param" with details).
  - Sanitize content to avoid security issues: e.g., when an author without unfiltered_html capability submits HTML content, WP strips disallowed tags. AstroPress should do similarly, possibly using a library to sanitize HTML or replicate WP’s KSES filters. This ties into the role/capability system (contributors cannot publish dangerous HTML, etc.).
- **Calling Core Services:** The REST handlers do not directly contain business logic; they call the underlying AstroPress services. E.g., a POST to create a post will call something like `PostsService.createPost(data, currentUser)`. That service will handle the logic of inserting to DB, applying default values (if not provided, e.g., if no excerpt, generate one or empty as WP does), calling hooks (e.g., plugin filters for content), etc. The service returns a representation of the new post.
- **Authorization checks:** The REST module ensures that each endpoint is accessed only by allowed roles. For example, `GET posts` (public can see published posts, but drafts only visible to authors or editors), `POST posts` (only authenticated users with proper capability, e.g., Author can create a post but some fields like status might be restricted – contributors can create but maybe not publish). WP usually also checks capability per action, like edit_others_posts etc. AstroPress will mirror these checks. Implementation-wise, we might have middleware or checks within handlers that consult the Auth system:
  - e.g., a middleware `requireAuth` for endpoints that need login (like creating posts, or any modifying action).
  - And finer checks: if updating a post, ensure `currentUser.can('edit_post', postId)` returns true (which internally checks if user is author of that post or has global edit_any capability).
  - The Auth system (discussed later) will provide functions like `userHasCapability(user, capability, maybeResource)` to support these decisions.
- **Extensibility hooks in REST:** Just like WordPress allows plugins to modify REST API behavior, our REST module has hook points:
  - Before responding, allow filters on the data. For example, WordPress has `rest_prepare_post` filter that lets plugins modify the response data for a post. AstroPress can implement a similar hook: after the PostsService returns the post data, but before JSON serialization, run any registered functions that can alter or add fields. This way, if a plugin wants to add a custom field to the REST output, it can. (Alternatively, we allow plugins to register new REST fields explicitly; either approach yields the same result: extensibility of the response.)
  - Custom routes: Provide an API for plugins to register new REST endpoints. This might be done by exposing an AstroPress function like `registerRestRoute(namespace, route, handler, options)` which plugins can call during their initialization. The REST module would have to mount these dynamically. Express allows adding routes at runtime (provided it’s done before requests arrive, or we manage it via a router that can be updated). For safety, AstroPress might load all plugins first at startup, then finalize route registration (so routes are static during runtime).
  - Modifying existing routes: Perhaps allow replacing a handler or adding middleware via hooks, though likely we encourage using the filters on output rather than replacing entire handlers (to maintain core stability).
  - Schema extension: If plugins add new content types (CPT or custom taxonomies), the REST module should dynamically reflect that. For example, registering a custom post type "portfolio" should ideally expose routes `/wp-json/wp/v2/portfolio` automatically. In WP, if `show_in_rest` flag is true for the CPT, WP REST API will expose it. In AstroPress, our Plugin API when registering a CPT can call into the REST module to add a new router for that CPT (which likely can reuse a generic handler template or a specialized one).
- **Output formatting:** After retrieving data from services and applying any filters, format the output JSON:
  - Ensure types (ints vs strings) match WP. WP often returns IDs as numbers, dates as strings, booleans for some, etc. We match exactly.
  - Omit any fields that WP wouldn’t send. Conversely, include all fields WP would, even if null. The WordPress REST API schema defines all fields; we should ensure none are forgotten.
  - Include `_links` always. If `_embed` was requested, include `_embedded` with proper structure.
  - For list responses (e.g., list of posts), it’s just a JSON array of objects, with the headers conveying pagination (not in the body). For single-object responses, it’s an object.
  - For delete operations, WP typically returns the deleted object data with a flag `deleted: true` in a wrapper. Specifically, WP REST DELETE on posts can return either 200 with the deleted post data (if ?force=true) or 200 with `previous` data if moved to trash. We’ll replicate that logic: support the `force` query param to bypass trash (if we implement a trash status in posts.status).
  
**Example Walk-through (Create Post):** An authorized user (with Author role) sends a POST to `/wp-json/wp/v2/posts` with JSON body `{"title": "My New Post", "content": "Hello", "status": "draft"}`.
  - Express route `/posts` (POST) triggers. Authentication middleware verifies the user token, identifies user 5 with role Author.
  - Handler checks `if (!currentUser.can('create_post'))` (capability check – Authors can publish_posts? Actually Authors can publish their own posts. We consider `'edit_posts'` or a meta capability calculation for new posts which usually maps to `publish_posts` for authors). Assuming Authors can publish, it passes.
  - It validates the input: title and content are present, `status: "draft"` is allowed (Author can save drafts, yes).
  - Calls `PostsService.createPost({title, content, status}, user)`:
    * The service sets up a new post object: fills author = user.id, sets dates (current time as post_date if not provided), generates a slug from title (if not provided), etc., similar to WP’s `wp_insert_post`.
    * It inserts the post row into DB (maybe within a transaction if also inserting meta or terms).
    * It triggers a hook event "post_created" for any plugin to act (e.g., to log activity or modify content before save – though content filters probably applied prior to insertion).
    * If success, returns the new post object (with its new ID).
  - Back in handler, the new post data is passed through a `rest_prepare_post` formatting function that builds the JSON: e.g., `id: newPost.id, date: newPost.post_date (ISO string), slug: newPost.post_name, status, title: { rendered: maybe newPost.title (escaped) }, content: { rendered: maybe apply_filters('the_content', content) }`, etc.
  - Because this is creation, WP would return 201 Created with the Location header of the new post. AstroPress will set status 201 and `Location: /wp-json/wp/v2/posts/{newId}`.
  - The body will be the post JSON. AstroPress sends that. If any errors occurred (e.g., DB error, or validation error), appropriate error JSON is returned instead (with WP’s format: e.g., 400 {"code":"rest_cannot_create", "message":"Sorry, you are not allowed to create posts as this user.", "data":{"status":401}} if auth issues, etc.).

**Admin-only Endpoints:** While most of `/wp/v2` is content, WordPress also has an administrative REST namespace for certain features (for example, the `/wp/v2/users` list requires admin, and the `/wp/v2/settings` which is site settings editing requires admin). AstroPress will implement those and also introduce new ones under perhaps an `astropress/v1` namespace for things that WordPress doesn’t have in REST (like installing plugins/themes, since WP didn’t expose that via REST by default).
- For instance, `POST /wp-json/astropress/v1/plugins` with a file could be for plugin upload (or perhaps use the media endpoint with a special type).
- `POST /wp-json/astropress/v1/plugins/{pluginSlug}/activate` to activate a plugin. That would call PluginService.activatePlugin and return success or error.
- These routes will be protected by admin capability (only admin role allowed). The response shape for these can be designed (since no WP equivalent, we have freedom, but should still be JSON with code/message maybe).
- We keep them separate from core `/wp/v2` to clearly distinguish AstroPress-specific management APIs.

### Extensibility and Hooks

The REST API module is designed to be **extensible** much like WordPress’s. We provide the following hooks and extension points:
- **Registering Custom Routes:** Through the plugin system, a developer can add new REST API endpoints. For example, a plugin might need an endpoint `/wp-json/myplugin/v1/do-something`. AstroPress will offer an API (maybe `AstroPressREST.registerRoute(namespace, route, methods, handlerFn, permissionsFn?)`). Under the hood, this hooks into Express to handle that path. We ensure that it integrates with our auth (the plugin can specify a permission callback or required capability).
- **REST API Filters:** As mentioned, filters like `rest_prepare_[post_type]` to modify response data for a given object type, `rest_before_insert_[post_type]` to alter data before it’s inserted, etc. We will call these at appropriate times. The plugin system needs to allow hooking these easily (similar to WordPress actions/filters concept).
- **Field Registration:** In WP, `register_rest_field` allows adding fields to the REST output for an object. We can implement a similar facility: e.g., a plugin could register a field "subtitle" for posts, with callbacks to get and update that field (which maybe maps to a meta key). AstroPress’s REST module, when preparing a post response, would call any registered field callbacks to append those fields to the JSON. This allows structured extension of output rather than just blanket filters.
- **Versioning and Compatibility:** If WordPress updates its REST API (say WP API v3 in the future), AstroPress could add a new namespace. The system is modular enough that we could support multiple versions if needed. Initially, we stick to v2 as that’s current standard.
- **Output customization:** Perhaps offer an option to compress responses (Express can use compression middleware). Also allow JSONP or other output formats if WP supported (WP REST can be requested with `?_jsonp=callback` to get JSONP response – we could consider supporting that for parity).

### Performance Considerations

While providing identical functionality, AstroPress’s REST API can be more performant than the original:
- **Caching:** We can cache REST responses for public GET requests. For example, the output of `GET /posts?page=1` could be cached for a short period (say 1 minute or configurable) because that data might be requested frequently ([WordPress REST API · WordPress VIP Documentation](https://docs.wpvip.com/wordpress-on-vip/wordpress-rest-api/#:~:text=Caching)). AstroPress can use an in-memory cache or Redis. On each request, the REST handler would check the cache (keyed by the request URI and maybe user role if needed, since an admin hitting the same endpoint would get drafts too – so cache should vary by auth context). WordPress VIP implements a 1 minute cache on REST responses by default ([WordPress REST API · WordPress VIP Documentation](https://docs.wpvip.com/wordpress-on-vip/wordpress-rest-api/#:~:text=By%20default%2C%20REST%20API%20endpoints,of%20the%20cached%20REST%20response)), and we can do similarly. Cached responses are invalidated or bypassed when relevant content changes: e.g., if a new post is published, the cache for listing posts must be cleared or we use short TTLs.
- **Compression:** We will enable GZIP/ Brotli compression on responses to reduce payload, especially for large responses like lists of posts or large HTML content. Many WordPress setups rely on webserver for compression; here we manage it directly in Node if not offloaded.
- **Selective Field Loading:** Using the `?_fields` query param, clients can ask for only certain fields. AstroPress will honor this and only compute/send those fields. E.g., `?_fields=title,excerpt` means we don’t need to assemble the entire post object with content, saving time. WP REST already supports this and we match it ([How To Specify the fields to Wordpress API v2 - Stack Overflow](https://stackoverflow.com/questions/36339689/how-to-specify-the-fields-to-wordpress-api-v2#:~:text=Here%27s%20how%20to%20access%20the,json%2Fwp%2Fv2%2Fposts%3F_fields%5B%5D%3Dtitle%26_fields%5B%5D%3Dexcerpt%26per_page)). This optimization is inherent in the API design and we’ll implement accordingly.
- **Efficient DB access:** Because we control the server logic, we can reduce the number of queries compared to WordPress’s naive approach. For example, listing 10 posts in WP might trigger multiple queries: one for posts, one for each taxonomy, one for each meta, etc. We can fetch posts and join or batch-fetch related data. If using an ORM or query builder, we can use joins to fetch author name or term names in one go. Or use DataLoader pattern (though that’s more in GraphQL, but we can utilize similar caching in REST handlers to prevent duplicate queries within one request).
- **Pagination performance:** For large data sets, `page=N` (offset pagination) can become slow if N is high due to OFFSET in SQL. We might introduce an improvement: if a client uses `offset` param or high page, we ensure indexes on date or id are used (they usually are in WP as well). We could also eventually support cursor-based pagination (like a `?after=<post_id>` param, though WP doesn’t by default). For parity, we keep offset, but our internal implementation in PostService might intelligently use indexed where clauses (e.g., if page 1000, maybe it uses id > some value if possible instead of pure offset).
- **Concurrent Request Handling:** Bun/Express can handle many simultaneous requests. If many REST requests come in, AstroPress can either scale vertically (Bun is fast) or horizontally (multiple instances behind a load balancer). The REST module is stateless (except caches), so scaling out is straightforward (with Redis or a shared cache to coordinate caches if needed). Each request is handled asynchronously in the event loop, and heavy operations (like image processing on media upload) could block – we’ll mitigate those by offloading as mentioned.
- **Data security and filtering overhead:** WordPress runs lots of PHP filters (like `the_content` filter which runs shortcodes, oEmbed etc.). These can slow down responses. AstroPress can replicate that functionality in Node; however, we could potentially do it more efficiently or allow disabling certain filters if not needed. For fairness, if we want identical output, we will run them. But maybe in Node, processing the content string (running regex for shortcodes, etc.) can be heavy – consider caching rendered content as well. E.g., after rendering and filtering a post content for output, cache that in memory keyed by (postId, maybe last modified time) so subsequent requests don’t redo shortcode parsing each time. This is an advantage since WordPress typically re-runs filters on every request.

Overall, the REST API module strives to provide **transparent compatibility**, while using the underlying AstroPress improvements to serve data faster and handle more load. It is the layer where WordPress’s external behavior is reproduced exactly, which means a lot of careful alignment with WP’s structure, but behind that facade, AstroPress can diverge in implementation to achieve better performance and maintainability.

## GraphQL API Module (WPGraphQL Compatible Interface)

In addition to the REST API, AstroPress offers an **optional GraphQL API** that is compatible with the WPGraphQL schema. WPGraphQL is a popular WordPress plugin that provides a GraphQL endpoint for WordPress content ([](https://www.wpgraphql.com/docs/introduction#:~:text=WPGraphQL%20is%20a%20free%2C%20open,47%20for%20any%20WordPress%20site)). AstroPress aims to provide a similar GraphQL interface out-of-the-box (if enabled in configuration), so developers can query the CMS data using GraphQL queries and even perform mutations (create/update content) through GraphQL, with the same business rules and permission checks as the REST API.

### Purpose and Benefits

- **Purpose:** Provide a modern GraphQL API that parallels all functionality of the REST API, enabling clients to retrieve exactly the data they need with a single request, and to navigate relationships between data easily. This GraphQL API should closely follow the WPGraphQL plugin’s schema so that queries written for WPGraphQL will work on AstroPress. It also leverages the advantages of GraphQL: precise data selection, nested queries (to reduce round trips), and a strongly typed schema which can be introspected.
- **Benefits:** 
  - Clients can fetch multiple related resources in one go (e.g., posts and their authors and comments) rather than multiple REST calls ([](https://www.wpgraphql.com/docs/wpgraphql-vs-wp-rest-api#:~:text=With%20the%20WP%20REST%20API%2C,get%20a%20list%20of%20posts)) ([](https://www.wpgraphql.com/docs/wpgraphql-vs-wp-rest-api#:~:text=It%E2%80%99s%20now%20your%20responsibility%20to,information%20that%20you%20don%E2%80%99t%20need)). 
  - GraphQL can be more efficient over the wire (smaller payload if the client only requests specific fields) ([](https://www.wpgraphql.com/docs/wpgraphql-vs-wp-rest-api#:~:text=This%20would%20include%20the%20posts%E2%80%99,unneeded%20data%20to%20be%20downloaded)), and it avoids sending unnecessary data that REST might include by default.
  - AstroPress’s GraphQL will use **batching and caching mechanisms** (like DataLoader) to resolve fields, making it potentially faster than equivalent sequences of REST calls ([](https://www.wpgraphql.com/docs/wpgraphql-vs-wp-rest-api#:~:text=DataLoader%20and%20the%20n%2B1%20problem)) ([](https://www.wpgraphql.com/docs/wpgraphql-vs-wp-rest-api#:~:text=Another%20reason%20why%20WPGraphQL%20can,%E2%80%9CDataLoader%E2%80%9D%20pattern%20to%20load%20resources)).
  - It provides a single endpoint (`/graphql`) which can simplify network configuration and benefits from GraphQL tooling (GraphiQL IDE, type generation, etc.).

### Schema Design (WPGraphQL Compatibility)

AstroPress’s GraphQL schema is designed to mirror WordPress’s content model:
- It includes types for all major WordPress entities: e.g., `Post`, `Page`, `MediaItem`, `Comment`, `User`, `Category`, `Tag`, etc., as well as some abstract types/interfaces for consistency (WPGraphQL defines interfaces like `Node`, `ContentNode`, `TermNode` since it uses Relay patterns).
- The schema follows the WPGraphQL approach of using **Connections** for relationships and pagination. For example:
  - To get a list of posts, the schema has a root field `posts` which returns a `PostConnection` type. That connection type contains `edges` (with each edge having a `node` = Post and a `cursor` for pagination) and meta-info like `pageInfo` (hasNextPage, endCursor, etc.). This is in line with GraphQL Connections spec, which WPGraphQL adopts ([](https://www.wpgraphql.com/docs/posts-and-pages#:~:text=Below%20is%20the%20same%20query%2C,field)) ([](https://www.wpgraphql.com/docs/posts-and-pages#:~:text=Filtering%20a%20List%20of%20Posts)).
  - Alternatively, WPGraphQL allows a simplified access with `nodes` directly under the connection to get an array of posts (they show skipping edges ([](https://www.wpgraphql.com/docs/posts-and-pages#:~:text=Below%20is%20the%20same%20query%2C,field))), and AstroPress will support that as well for convenience.
  - For querying a single post, there is a field `post(id: ID!, idType: PostIdType!)` where `idType` can be `DATABASE_ID` (the numeric ID), `SLUG`, or `URI` to specify how the id is interpreted ([](https://www.wpgraphql.com/docs/posts-and-pages#:~:text=Single%20Post%20by%20Global%20ID)) ([](https://www.wpgraphql.com/docs/posts-and-pages#:~:text=Single%20Post%20by%20Database%20ID)). AstroPress implements this logic – decoding a global relay ID or using the idType and the underlying service to fetch the correct post.
  - Similarly, `page(id: ..., idType: ...)` for pages, or one unified field if WPGraphQL uses a single `contentNode` field for any post type by ID (we’ll follow WPGraphQL’s structure exactly).
- **WPGraphQL Global IDs**: WPGraphQL encodes global IDs (the `id` field on types is often a base64 encoding of a type name and database id). AstroPress will support the same encoding scheme to maintain compatibility with existing GraphQL queries that use the global IDs. For instance, a Post with database ID 123 might have a global ID like `cG9zdDoxMjM=` (which decodes to `post:123`).
- **Mutations:** The schema includes mutations for creating, updating, deleting content ([](https://www.wpgraphql.com/docs/posts-and-pages#:~:text=WPGraphQL%20provides%20Mutations%20,show%20in%20the%20GraphQL%20Schema)) ([](https://www.wpgraphql.com/docs/posts-and-pages#:~:text=mutation%20CREATE_POST%20,id%20title%20date)). WPGraphQL typically defines mutations such as `createPost(input: CreatePostInput!): CreatePostPayload` (with the created post in the payload), similarly `updatePost`, `deletePost`, and analogous ones for other types (createComment, registerUser, etc.) for operations that WordPress permits. AstroPress will implement these mutations and ensure they enforce the same permission rules (e.g., a user must have rights to create a post, otherwise the mutation returns an error).
- **Other schema elements:** 
  - **Interfaces**: WPGraphQL defines interfaces like `Node` (with id), `ContentNode` (for objects that are content and have fields like title, content), `TermNode` (for taxonomy terms), etc. ([](https://www.wpgraphql.com/docs/default-types-and-fields#:~:text=Next%2C%20WPGraphQL%20registers%20Interfaces,Interfaces%20are%20registered%20by%20default)) ([](https://www.wpgraphql.com/docs/default-types-and-fields#:~:text=,NodeWithPageAttributes)). AstroPress will include these so that types implement them and one can query generically if needed.
  - **Enums**: Enums for status (PostStatusEnum with values PUBLISH, DRAFT, etc.), for comment status, user roles maybe, and so on ([](https://www.wpgraphql.com/docs/default-types-and-fields#:~:text=,PostStatusEnum)) ([](https://www.wpgraphql.com/docs/default-types-and-fields#:~:text=)). We define them consistent with WPGraphQL.
  - **Input types**: e.g., filter inputs for queries. WPGraphQL allows filtering the posts query via a `where` argument that takes a `PostObjectsWhereArgs` input object (for filtering by author, search term, date range, tax query, etc.). We will implement a comparable set of filters. For example, `posts(where: {author: 5, search: "keyword"})` should work and internally get translated to the appropriate DB query ([](https://www.wpgraphql.com/docs/posts-and-pages#:~:text=,a%20specific%20author)) ([](https://www.wpgraphql.com/docs/posts-and-pages#:~:text=,search%20keyword)).
  - **Connections for relationships**: e.g., a Post type will have `comments` field returning a CommentConnection (with args for pagination), `author` field returning a User (in WPGraphQL it's often `author { node { ... } }` since author implements an interface), `categories` and `tags` returning Term connections, etc. We ensure all these relationships are wired up.
  - **Viewer/User fields**: Typically WPGraphQL has a `viewer` field for the current logged-in user info. We can include that for convenience (resolves based on auth token).
  - **Settings**: WPGraphQL also has a `generalSettings` or similar field to fetch site settings like title, which maps to options. AstroPress can expose that as well (reading from our Options).
  
In essence, AstroPress’s GraphQL schema aims to provide **familiar types and fields to WPGraphQL users**, covering all standard WordPress data and respecting the same naming and structure.

### GraphQL Execution and Resolvers

AstroPress will utilize a GraphQL server library (likely Apollo Server, Express-GraphQL, or similar that works with Bun) to handle the /graphql HTTP endpoint. The flow:
- The GraphQL HTTP endpoint accepts queries (and mutations) via POST (and maybe GET for simple queries as per GraphQL spec). We likely include GraphiQL IDE in development mode for exploration.
- We define resolver functions for each type’s fields. These resolvers will use the underlying AstroPress services (the same ones used by REST) to fetch data. For example:
  - The resolver for the `posts` query will call PostsService.listPosts with the filters from args, similar to REST list, but potentially with the ability to not fetch all data until needed by subfields.
  - The resolver for `Post.author` field will likely call UsersService.getUserById. However, if we are querying a list of posts and for each their author, we want to avoid N queries for N posts. This is where the **DataLoader** pattern comes in: We can use DataLoader (or our own batching) to collect all author IDs needed in a request and fetch them in one query ([](https://www.wpgraphql.com/docs/wpgraphql-vs-wp-rest-api#:~:text=DataLoader%20and%20the%20n%2B1%20problem)) ([](https://www.wpgraphql.com/docs/wpgraphql-vs-wp-rest-api#:~:text=Another%20reason%20why%20WPGraphQL%20can,%E2%80%9CDataLoader%E2%80%9D%20pattern%20to%20load%20resources)). WPGraphQL explicitly cites DataLoader as a reason it’s often faster than REST ([](https://www.wpgraphql.com/docs/wpgraphql-vs-wp-rest-api#:~:text=Another%20reason%20why%20WPGraphQL%20can,%E2%80%9CDataLoader%E2%80%9D%20pattern%20to%20load%20resources)). AstroPress will incorporate this:
    * We create DataLoader instances for key data fetches (e.g., one for users by ID, one for terms by postID, etc.) tied to the GraphQL context for each request.
    * When a resolver for author runs, instead of calling UsersService directly, it adds the userId to a batch loader. The DataLoader will later call UsersService.getUsersByIds([array]) to retrieve them all at once. The result is then distributed to the resolvers.
    * This drastically reduces queries: a single GraphQL query for 100 posts and their authors becomes, for example, 1 query for posts and 1 query for those authors, rather than 101 queries.
  - Similarly, for terms: if querying posts and inside each post the categories, the categories field resolver can batch all category term IDs for those posts and fetch in one query from the database (join through term_relationships and terms).
  - For comments: if asking for comments of many posts, batch by post IDs.
  - DataLoader also caches within the request, so if the same user ID is needed multiple times, it’s fetched once.
- For mutations, resolver will parse the input, perform similar validation and permission checks as REST (likely by calling the same service functions like createPost or updatePost). If an error or unauthorized, the resolver throws or returns a GraphQL error which the library will format.
- **Auth in GraphQL:** We integrate with the Auth system by providing the current user info in the GraphQL context (the Express middleware for GraphQL will decode the auth token/cookie and attach `currentUser` to context). Resolvers then can enforce permissions:
  - For queries: e.g., the posts query should by default only return published posts for non-auth users, but if an authenticated user queries their own drafts, how is that handled? WPGraphQL often has it such that it will not return drafts unless the querying user has permission. We will implement similar checks. Possibly, WPGraphQL’s `viewer` and the use of `conditional fields` ensures that, for instance, the content of a draft might return null if unauthorized. We should verify WPGraphQL’s approach (they mention adhering to core access control rights ([](https://www.wpgraphql.com/docs/posts-and-pages#:~:text=WPGraphQL%20provides%20Mutations%20,show%20in%20the%20GraphQL%20Schema))).
  - For simplicity: We will check in each resolver if the data being accessed is allowed. For example, Post resolver might check if post.status is not published and currentUser cannot edit it, then maybe exclude it (or the posts list query filters them out initially). Or more elegantly, the service call for listPosts given a certain user context will only fetch what that user is allowed to see (like REST does by context=view vs edit).
  - If unauthorized access is attempted (like querying a draft post by someone who shouldn’t), the resolver could return null for that field or throw an authorization error consistent with WPGraphQL’s practice (likely returns null with errors array entry).
- **Performance and Caching:** GraphQL has the advantage of letting clients specify fields, but popular queries might still be cacheable. We can implement an in-memory or persistent query cache for GraphQL as well. For instance, if the same query text with same variables is called often by many clients (though in GraphQL, clients often vary queries), we could cache the result for a short time. Alternatively, we focus on the DataLoader approach as the main performance booster.
  - We should also consider complexity limiting: GraphQL queries can be arbitrarily nested (like asking for posts and within each the author’s posts and within those their authors etc.). We might enforce a maximum depth or query complexity score to prevent very expensive queries from a single call. WPGraphQL likely has recommendations on that.
  - Rate limiting and cost analysis might be an advanced feature (maybe not in spec scope, but worth noting).
  
- **Example Query and Resolution:** 
  - Query: 
    ```graphql
    query {
      posts(where: { categoryName: "Tech" }, first: 5) {
        nodes {
          id
          title
          date
          author {
            node {
              name
              avatar {
                url
              }
            }
          }
          categories {
            nodes { name }
          }
        }
      }
    }
    ```
    The resolvers would:
    * Posts root resolver: call PostsService.listPosts with filter categoryName=Tech (which the service translates to term lookup for category "Tech" to get its ID, then fetch posts in that category, limit 5).
    * It returns 5 post objects. GraphQL then goes into each post node:
      - For each, `title` and `date` are simple scalar fields resolved directly from the object.
      - `author` field: the resolver uses DataLoader to batch all 5 posts’ authorIDs, fetch the user rows in one query via UsersService. Then returns each appropriate user. The subfields of author (`name` and `avatar.url`) are resolved from the user object (avatar might be a computed field or stored in meta).
      - `categories` field on each post: the resolver batches these 5 posts, fetches their categories via one query (join term_relationships -> terms where taxonomy=category), grouping results by post. Returns a connection or list of category nodes. The subfield `name` is then taken from each term.
    * The final result is assembled and sent as JSON. The GraphQL library will include only the requested fields.
    
  - This yields what a client needs in one request rather than multiple REST calls for posts then authors then categories. And our implementation ensures the DB was only hit a minimal number of times (in this example, likely 3 queries: one for posts filtered by category, one for authors of those posts, one for categories of those posts).
  
### Interactions with Other Systems

The GraphQL module is deeply tied to the other subsystems:
- It uses the **Data Services** (PostService, etc.) to get and modify data, ensuring business logic (and thereby consistency with REST operations).
- It relies on the **Authentication system** to know who is making the request, and on the **Authorization (roles/caps)** to enforce who can see or do what. We will use the same checks; possibly encapsulated in service calls as described. E.g., PostService.getPost(id, user) might return null or throw if user isn’t allowed to see it.
- The GraphQL schema may need to integrate with the **Plugin system**:
  - Allowing plugins to extend the schema: WPGraphQL provides ways to register new types or fields (there’s an extension API ([](https://www.wpgraphql.com/docs/introduction#:~:text=,and%20the%20WordPress%20REST%20API))). AstroPress could let plugins supply GraphQL schema extensions or resolver functions to add, say, a new field or custom post type queries.
  - For example, if a plugin adds a custom post type “Book”, if that CPT is flagged to show in GraphQL, the plugin should be able to extend the schema with a `books` query field and a `Book` type (or maybe AstroPress can generate that automatically based on a generic template for any CPT).
  - Similarly, custom taxonomies, or even custom fields on types (like adding an extra field to the Post type) could be done via schema extension.
  - We might implement a mechanism on startup: after core schema is built, iterate through plugins that provided schema additions (perhaps in SDL or using a schema AST) and merge them. Apollo Server or graphql-js allows schema stitching or building schema programmatically.
  - Ensuring that these new fields resolve via provided plugin logic or maybe tie into meta (for custom fields).
- **Content Filtering:** If WordPress filters content (like shortcodes expansion) before outputting in REST, in GraphQL we have to consider whether to deliver raw content or rendered. WPGraphQL by default returns the raw content (unfiltered, I believe), leaving it to the front-end to handle shortcodes or to maybe use an option to get rendered content. We should verify WPGraphQL’s approach:
  - Quick guess: They likely return content unmodified (except perhaps with some minimal formatting), assuming the client can use it as needed. Actually, WPGraphQL might have a setting or separate field for the rendered HTML vs raw. It does mention in their docs ensuring you have to run things like block parsing on the client if needed.
  - For compatibility, we can include both or choose one. Possibly provide two fields: e.g., `content(format: RENDERED)` vs `RAW`, similar to how WPGraphQL might do. Or have `content` and `contentFormat` args.
  - We'll assume we provide at least the raw content (so front-ends can use their own rendering, e.g., if using React for front-end, they might process blocks differently).
  - Regardless, if a plugin modifies content (like an SEO plugin adding meta to content), our hooks should ensure the GraphQL can optionally reflect that if needed. Maybe simpler: GraphQL gives raw and the plugin's client part handles it. Keep it consistent with WPGraphQL’s decisions.
- **Batching and Caching integration:** If we use a cache (like Redis) for some queries, GraphQL could benefit as well. Perhaps caching entire GraphQL query responses is less straightforward due to variety, but caching at the resolver level could be done. For instance, we might cache the result of expensive sub-resolvers (like if a field requires a heavy computation). However, given data is mostly from DB which we can cache at query level, it's likely enough.
- **GraphQL vs REST parity:** Everything that can be done via REST should be doable via GraphQL:
  - Reading any content or list – yes.
  - Authenticated retrieval of private data – yes (with appropriate auth).
  - Modifying data – yes via mutations (create/update/delete).
  - Some admin operations (like install plugin) – WPGraphQL plugin doesn’t cover that usually, but maybe we could expose some of those as well under mutations if needed (or keep those to REST admin endpoints only). Possibly out of scope for GraphQL if we consider GraphQL mainly for content. We can note that administrative tasks remain in REST (or separate GraphQL if we wanted to extend).
  
### Security and Permissions in GraphQL

Adhering to the same security model is crucial:
- The GraphQL API **respects WordPress roles/capabilities** just like REST. WPGraphQL states it “adheres to core access control rights” ([](https://www.wpgraphql.com/docs/posts-and-pages#:~:text=WPGraphQL%20provides%20Mutations%20,show%20in%20the%20GraphQL%20Schema)). For example:
  - If a user is not logged in, queries to list posts will only return published posts, and fields that are sensitive (like an unpublished post content) will not appear.
  - If a user tries to query all users, but they are not admin, maybe the server returns an error or an empty set (WPGraphQL likely restricts user query to only the viewer or nothing unless capability allows).
  - Mutations: if not authorized, the mutation resolvers return errors (GraphQL errors with messages akin to “You do not have permissions to edit this”).
  - We must be careful to not over-disclose via GraphQL – e.g., even the schema itself might reveal things. WPGraphQL only exposes in schema what you have access to, or does it expose everything? Typically GraphQL schema is static regardless of user, which could mean the existence of certain types/fields is known. But actual data won’t be returned if no access.
  - We can keep schema static (all types visible) but enforce at resolver. That's fine, as long as sensitive data is protected at resolve time.
- **Authentication mechanism:** Likely we’ll use the same token (JWT or session) as REST. A client can include an Authorization header with the token in GraphQL requests. We parse it in Express middleware and attach user to context. Alternatively, allow Basic Auth (like Application Password) as well. So GraphQL isn’t second-class: any auth method available to REST could be accepted here.
- Possibly we can support API keys or App Passwords – up to implementation, but at least one method to authenticate GraphQL.
- We should also ensure to handle introspection properly. Usually introspection is fine (GraphQL needs it for tooling). But if there were any fields that only admin should even know about, that’s not typical because if it’s in schema at all, it’s visible. So we likely won’t have fields that truly need hiding at schema level (if a site doesn’t want GraphQL, they just disable the module entirely).

### Extensibility of GraphQL

We touched on schema extension by plugins. To outline clearly:
- **Custom Post Types**: When a plugin registers a new post type that is meant to be exposed, AstroPress will:
  - Add a new GraphQL type for that CPT (unless the plugin provides its own type definition).
  - Possibly if plugin devs want control, they can provide type name and fields. WPGraphQL uses the post type name to generate a type (like a CPT `movie` can become type `Movie` with fields similar to Post plus any custom fields).
  - Add root fields: e.g., `movies` (MovieConnection), `movie(id: ID!)`.
  - Ensure resolvers for those reuse the PostsService but with a filter on post_type or a new service if specialized.
  - This could be somewhat automated or require plugin to call an API for GraphQL registration.
- **Custom Fields**: If a plugin adds a meta field or some computed field, it might want to expose it in GraphQL. WPGraphQL requires explicit addition of fields to schema (GraphQL schemas are not auto-flexible like REST output). So the plugin would use something like:
  - `AstroPressGraphQL.registerField(typeName, fieldName, fieldConfig)` specifying how to resolve it. For example, adding `rating` field to `Post` type, resolved by reading a meta.
- **Custom Taxonomies**: similar to CPT, create GraphQL type for the taxonomy (if WPGraphQL does that; often they might reuse a `Term` interface and have union of taxonomies).
  - WPGraphQL likely gives each taxonomy its own type (Category and Tag are separate types implementing a Term interface). We will do likewise.
- Our GraphQL module likely uses a schema definition approach where we can programmatically build or extend the schema. We could use SDL string and the Apollo server `makeExecutableSchema`, or directly graphql-js `GraphQLObjectType` definitions. Given dynamic nature for plugins, programmatic might be easier.
- The plugin system can also provide **resolvers** for their new fields if they require custom logic. If not provided, AstroPress will default to perhaps looking in meta or something if configured to do so.

### Performance Considerations for GraphQL

GraphQL’s flexibility demands careful performance management:
- As discussed, **DataLoader** is vital to avoid N+1 queries and WPGraphQL attributes much of its performance advantage to batching ([](https://www.wpgraphql.com/docs/wpgraphql-vs-wp-rest-api#:~:text=DataLoader%20and%20the%20n%2B1%20problem)). AstroPress will instantiate DataLoaders for common patterns:
  - Load posts by IDs (in case querying related posts or by connection edges).
  - Load users by IDs.
  - Load comments by IDs or by post.
  - Load term relationships by post or by term.
  - Perhaps load meta in batch if lots of meta requested (though usually specific fields).
- **Query Complexity**: We might implement a query complexity analyzer. This could assign a cost to fields (e.g., listing 100 posts with deep nested might be expensive). WPGraphQL documentation might have recommendations, or we can define maximum `first` parameter (maybe default limit of 100, like WP REST default per_page=100). We should enforce limits: e.g., even if a query asks for 1000 posts, we might cap at 100 unless explicitly allowed. This is akin to how WP REST caps at 100 per page by default. So in resolvers for connection, if first > 100 and user not allowed, clamp it or throw.
- **Caching**: If using an external caching layer (like Redis), we could consider caching some GraphQL results. But since GraphQL queries can be arbitrary combos, caching is often best done either at a higher level (HTTP layer with persisted queries keys) or at the level of DataLoader (caching DB results). We primarily rely on the latter. 
  - E.g., if 10 users request the same query for homepage, it might be worth caching that response for a brief time. Implementation might be complex without a persisted queries system. Instead, we encourage clients to use their own caching (Apollo client cache, etc.). On server, we ensure queries are fast enough raw.
- **Subscriptions**: WPGraphQL doesn’t do realtime subscriptions by default. AstroPress likely won’t implement GraphQL subscriptions initially (not requested). If needed, that could be an extension (like using WebSockets), but out of scope for now.
- **Parallel execution**: GraphQL by design resolves fields in parallel where possible. This means multiple DataLoader loads could happen concurrently. We should ensure our DataLoader and service methods are thread-safe or at least non-blocking. Using Bun and promises should handle concurrency fine, but we must avoid race conditions (like two mutations at same time – though GraphQL will run mutations serially per request).
- **Apollo Federation or external integration**: Unlikely needed, since AstroPress is the sole service.

In summary, the GraphQL module provides a powerful alternative API for AstroPress, aligning with the WPGraphQL schema for familiarity. It interacts with core services to enforce the same rules and uses performance techniques like batching to make complex data retrieval efficient. This gives developers the choice of REST or GraphQL without sacrificing any WordPress features, making AstroPress suitable for modern decoupled architectures (e.g., a React front-end can use GraphQL to fetch WordPress content from an AstroPress instance easily).

## Authentication and Authorization System

A secure and flexible **authentication and authorization** system is central to AstroPress. It ensures that only legitimate users can log in and that each user can only perform actions permitted by their role/capabilities (just like WordPress’s roles and caps model). AstroPress’s auth system is designed to be compatible with WordPress concepts (users, roles, capabilities) while using modern security best practices (hashed passwords, token-based authentication, optional OAuth integration).

### Purpose and Requirements

- **Purpose:** Manage user identity (authentication) and enforce access control (authorization) for all server-side operations. This system verifies credentials (like username/password or external OAuth tokens), issues some form of session or token to the client, and then uses that to check permissions on each request. It also provides user management capabilities (create users, assign roles, password reset, etc.) as part of the admin functionality.
- **Requirements:**
  - Support **WordPress user roles and capabilities** so that AstroPress can restrict actions in the same way WordPress would. For example, only Admins can install plugins, Editors or higher can edit others’ posts, etc. ([Roles and Capabilities – Documentation – WordPress.org](https://wordpress.org/documentation/article/roles-and-capabilities/#:~:text=,can%20only%20manage%20their%20profile)). This means our auth system must include a roles database and logic to check capabilities.
  - Provide **password-based login** (the classic email/username + password form). Passwords must be stored hashed (never plaintext) using a secure algorithm. The login process should be secure against common attacks (SQL injection – not possible if using param queries; timing attacks – use constant time compare; brute force – consider rate limiting).
  - Provide **optional OAuth login** with third-party providers (like GitHub, Google). This means if enabled, users can authenticate via OAuth2 flows, and AstroPress will map that to a local user account. It should be configurable (enable/disable providers, set client IDs/secrets).
  - Possibly support **Application Passwords** or API tokens for programmatic access, similar to WordPress’s Application Password feature (which allows creation of a base64 token for a user to use in API calls ([WordPress REST API · WordPress VIP Documentation](https://docs.wpvip.com/wordpress-on-vip/wordpress-rest-api/#:~:text=Caching))). This is not explicitly requested, but something to consider as it’s part of WP’s approach to API auth.
  - The system must be **extensible**: allow additional auth methods via plugins (e.g., SSO integration, 2FA enforcement, etc.), and allow plugins to add custom capabilities or roles.
  - Ensure all authentication flows are done over HTTPS (though that’s deployment config; we will note that tokens etc. must be protected by TLS).
  
### Authentication Mechanisms

**1. Password Authentication (Core):**  
AstroPress will implement an endpoint for user login. For example, a REST endpoint `POST /wp-json/jwt-auth/v1/token` (if emulating the JWT Authentication for WP REST plugin), or we can create `/wp-json/astropress/v1/login` that accepts username and password. On successful authentication:
  - We generate a **token** (likely a JWT – JSON Web Token) signed by the server. The JWT payload could include the user’s ID, username, roles, and an expiry time. The token is then returned to the client. Subsequent requests should include this token (e.g., in `Authorization: Bearer <token>` header).
  - Alternatively, we could use session cookies. But since we’re focusing on an API, JWT stateless tokens are convenient.# AstroPress Server Architecture Specification

## Introduction

AstroPress is a modern reimplementation of the WordPress backend, designed to be a **robust, high-performance server-side platform**. It replicates WordPress’s functionality and data structures on a modern stack (Bun + Express + PostgreSQL), providing full compatibility with the WordPress REST API and an optional WPGraphQL schema. This specification describes AstroPress’s **server-side architecture** in detail – every major subsystem, its purpose, responsibilities, interfaces, and interactions – aimed at developers and system architects. The focus is purely on backend logic (no client-side code or UI), outlining how AstroPress will deliver a WordPress-equivalent experience through modern technology.

**Key Goals and Features:**

- **Complete WordPress API parity:** AstroPress exposes a REST API matching WordPress (1:1 routes and JSON response shapes) so existing tools and clients can interact seamlessly. Optionally, it also offers a GraphQL API compatible with the WPGraphQL plugin schema for more flexible queries.
- **Modern Stack Benefits:** Built on Bun (a high-performance JavaScript runtime) and Express (a proven web framework), AstroPress benefits from improved speed, efficient I/O, and modern development workflows, while preserving WordPress’s behavior.
- **PostgreSQL Database:** All WordPress-equivalent data (posts, pages, users, comments, terms, metadata, etc.) is stored in PostgreSQL, taking advantage of its reliability and performance features. The data schema mirrors WordPress’s structure so content and relationships remain consistent, enabling easy data migration and familiarity.
- **Extensible and Secure:** The architecture includes a robust authentication/authorization system with WordPress-style user roles and capabilities, support for password auth and optional OAuth login, and a plugin system for extending functionality (hooking into REST/GraphQL APIs, database actions, and content filters) similar to WordPress’s plugins.
- **Media Handling and Admin Tools:** A media file management system is included (local filesystem by default, with optional S3 integration) along with admin-only endpoints for managing plugins and themes (upload, activate, deactivate, etc.), providing parity with WordPress’s admin capabilities in a headless context.
- **Performance Optimization:** AstroPress is designed with performance in mind – query caching (in-memory or Redis), efficient pagination and data loading, and proper indexing – to outperform a typical WordPress/PHP setup while maintaining the same output and behavior for clients.

This document is organized by subsystem. Each section details the **purpose** of the component, its **responsibilities**, exposed **interfaces/APIs**, how it interacts with the **database** and other components, available **extensibility hooks**, and relevant **performance considerations**. Together these sections define a comprehensive technical specification for the AstroPress server-side architecture – essentially, how to build the most robust, WordPress-compatible backend ever, using modern tools.

## High-Level Architecture

AstroPress’s server is structured in a modular way, with clear separation of concerns between the web/API layer, the business logic layer, and the data layer. At a high level, incoming HTTP requests (REST or GraphQL) are handled by Express routes or middleware, which invoke core services (for content, users, etc.) that interact with the PostgreSQL database and other subsystems (authentication, plugins, caching, etc.). The design emphasizes **modularity** (each subsystem encapsulates specific WordPress-like functionality) and **extensibility** (plugins can hook into defined points to modify or extend behavior).

**Core Technology Stack:**

- **Bun Runtime:** AstroPress runs on Bun, a modern JavaScript runtime that uses the JavaScriptCore engine. Bun provides faster startup and execution than Node.js in many cases and efficient bundling of code. It fully supports Node APIs, so popular libraries like Express and pg (PostgreSQL client) work seamlessly. Bun’s performance characteristics (high I/O throughput, optimized JIT) help AstroPress handle concurrent requests efficiently.
- **Express Framework:** The server uses Express.js for HTTP request handling. Express provides a robust routing system and middleware pattern ideal for implementing the numerous REST API endpoints of WordPress. Each WordPress REST route is mapped to an Express route handler. Express’s middleware is also used for cross-cutting concerns (authentication, logging, error handling, caching). The choice of Express ensures a familiar structure and easy maintainability, and it integrates well with other Node.js libraries (for GraphQL, file upload, etc.).
- **PostgreSQL Database:** All persistent data is stored in a PostgreSQL database. PostgreSQL is chosen for its reliability, strong ACID compliance, advanced features (JSON support, indexing options), and scalability. The schema closely follows WordPress’s MySQL schema (tables for posts, users, comments, terms, metadata, options, etc., with equivalent fields), enabling data parity and potential migration of content from WordPress. A data access layer or ORM (e.g., using node-postgres or an ORM like Prisma/TypeORM) is used to interact with the DB, abstracting SQL queries and handling connection pooling.
- **Core Service Modules:** AstroPress is organized into service modules (Content service, User service, Comment service, Taxonomy service, etc.), each responsible for a specific domain of data and logic. These services correspond to WordPress concepts (e.g., a Posts service analogous to WP’s post handling in core). They encapsulate business rules (like ensuring a draft post can only be viewed by its author, or updating term counts when a post’s categories change) and interact with the DB via the data layer. By centralizing logic here, both REST and GraphQL interfaces reuse the same behaviors for consistency.
- **API Layer (REST & GraphQL):** On top of the services sits the API layer. The REST API module defines Express routes under `/wp-json/wp/v2/...` matching WordPress endpoints and uses the services to fulfill requests, then formats output to match WordPress JSON. The GraphQL API (if enabled) exposes a `/graphql` endpoint implementing the WPGraphQL-compatible schema, using the same services under the hood for data fetching. Both API layers enforce authentication and authorization rules via shared middleware or context (so access control is consistent).
- **Authentication & Authorization:** A centralized auth system verifies users and enforces permissions. It supports traditional WordPress username/password login (with secure hashed password storage) and can integrate OAuth providers (GitHub, Google, etc.) if configured. Once authenticated, requests carry a token or session that identifies the user, and role/capability checks are performed for protected actions. The roles and capabilities mirror WordPress’s (Administrator, Editor, Author, Contributor, Subscriber, etc., with granular caps like `publish_posts`, `edit_others_posts`, `manage_options`, etc. ([Roles and Capabilities – Documentation – WordPress.org](https://wordpress.org/documentation/article/roles-and-capabilities/#:~:text=WordPress%20has%20six%20pre,functions)) ([Roles and Capabilities – Documentation – WordPress.org](https://wordpress.org/documentation/article/roles-and-capabilities/#:~:text=,can%20write%20and%20manage%20their))).
- **Plugin System:** AstroPress offers a plugin architecture analogous to WordPress’s. A Plugin Manager loads plugin modules (written in JavaScript/TypeScript) which can register hooks into the system. Hook points are provided in the API layer (to add routes or fields), in content processing (to filter content or metadata), and in the data layer (to react to events like “post saved” or “user created”). Admin endpoints allow installing and managing plugins. This system makes AstroPress **extensible**, enabling third-party developers to add features or modify behavior without altering core code.
- **Media Management:** The media subsystem handles file uploads and media data (images, videos, documents). It stores media metadata in the database (as “attachment” posts, similar to WordPress) and the files on the server’s filesystem by default. It also supports alternative storage (like Amazon S3) via a storage interface – administrators can configure an S3 bucket, and the media system will store and serve files from S3 instead of local disk. This subsystem ensures parity with WordPress’s media handling (including generating appropriate response data, metadata like image dimensions, and supporting various MIME types).
- **Admin Tools:** Certain operations, like installing a new theme or plugin, activating/deactivating them, editing site settings, etc., are restricted to administrators. AstroPress provides admin-only REST endpoints (e.g., under `/wp-json/astropress/v1/...`) to perform these tasks. These endpoints allow an external admin UI (or CLI tool) to manage the AstroPress installation in ways that WordPress’s wp-admin interface would – for example, uploading a plugin ZIP and activating it, or switching the active theme. The admin routes tie into the plugin system (for plugin activation) and configuration management.
- **Performance & Caching:** To achieve superior performance, AstroPress employs caching and optimization at multiple levels. Frequently accessed data and expensive queries can be cached in memory or an external cache (Redis) to avoid repeated DB hits ([WordPress REST API · WordPress VIP Documentation](https://docs.wpvip.com/wordpress-on-vip/wordpress-rest-api/#:~:text=Caching)). The system uses **smart pagination** techniques and **batch data loading** to handle large datasets efficiently (especially in GraphQL, using techniques like DataLoader to avoid N+1 queries ([](https://www.wpgraphql.com/docs/wpgraphql-vs-wp-rest-api#:~:text=DataLoader%20and%20the%20n%2B1%20problem))). Database schema and queries are optimized with appropriate indexes and careful denormalization (reflecting WordPress’s approach of balancing normalized data with some precomputed fields like counts). We detail these techniques in the relevant sections, ensuring AstroPress is highly performant at scale.

All these components work together to deliver a **fully WordPress-compatible backend**. From an external perspective, a developer could point a WordPress REST API client or GraphQL query tool at AstroPress and see no difference in functionality or data structures, except faster responses and greater scalability. Internally, however, AstroPress is a reimagined engine – leveraging modern tech to overcome many limitations of the legacy PHP WordPress implementation.

The following sections break down each major subsystem in detail, including how they correspond to WordPress behavior and how they improve upon it.

## Data Model and Database Schema

At the heart of AstroPress is the data model, which mirrors WordPress’s content structure. Maintaining a similar schema ensures 1:1 mapping of concepts (posts, users, comments, terms, etc.) and facilitates reuse of WordPress conventions. The database is PostgreSQL, but the schema uses equivalent tables and relationships to the WordPress MySQL schema (with some modernization where appropriate). **Every piece of WordPress data has a place in AstroPress’s database.** 

 ([The Ultimate Developer's Guide to the WordPress Database](https://deliciousbrains.com/tour-wordpress-database/)) *Figure: WordPress core database tables and their relationships (AstroPress uses an analogous schema). Posts (wp_posts) link to users (wp_users) via author, comments (wp_comments) link to posts, terms relate to posts via wp_term_relationships, etc. Meta tables store key–value pairs for extensibility.* ([The Ultimate Developer's Guide to the WordPress Database](https://deliciousbrains.com/tour-wordpress-database/#:~:text=Someone%20has%20produced%20a%20helpful,the%20structure%20is%20still%20current)) ([The Ultimate Developer's Guide to the WordPress Database](https://deliciousbrains.com/tour-wordpress-database/#:~:text=,wp_terms))

**Posts (and Pages):** The `posts` table (analogous to `wp_posts`) stores blog posts, pages, and other content types. Key fields include:
- `ID` (primary key), `post_title`, `post_content`, `post_excerpt` for content fields.
- `post_status` (e.g. publish, draft, pending), `post_type` (e.g. post, page, attachment).
- `post_date` (publish date) and `post_date_gmt` (GMT timestamp) for scheduling.
- `post_name` (slug), `post_parent` (for hierarchical pages or attachments), `menu_order` (for ordering pages).
- `post_author` (foreign key referencing the users table), and `comment_count`, `comment_status` (open/closed) for comments on that post.
- `post_mime_type` (used if post_type is attachment to denote file type) and `guid` (a globally unique identifier, often a URL to the content).
  
All standard WordPress post types (posts, pages, attachments, nav_menu_items, etc.) are represented here. AstroPress enforces relationships with foreign keys where appropriate (e.g., `post_author` references users, `post_parent` references another post). It also supports **revisions**: if post revisions are enabled, revisions are stored as entries with `post_type='revision'` linking to their parent post via `post_parent`.

**Responsibilities:** The Posts table holds all content entries. AstroPress ensures that:
- Business logic such as status transitions (e.g., when a scheduled post’s time is reached, it moves from `future` to `publish`) is handled, possibly via a scheduled task.
- When a post is published or updated, any related data (like caches or related term counts) are updated accordingly.
- Hierarchical data (pages) are handled (e.g., deletion of a parent page may update children).
- The system maintains parity with WordPress’s content behavior, including support for features like sticky posts (`sticky` meta in WP) or post formats (stored in post meta or taxonomy in WP, but supported as needed).

**Interfaces & API:** Posts are exposed via REST API (e.g., `GET /wp-json/wp/v2/posts`) and GraphQL (e.g., `posts` query). These interfaces retrieve from the posts table with filters (status, author, taxonomy terms, search term, etc.) and join with related tables (e.g., to include author name, or to filter by category via term relationships). Creating or editing a post through the API translates to insert/update queries on this table (and associated meta or term tables). Deleting a post may either trash it (set status to `trash`) or permanently remove it, with the system offering both behaviors consistent with WP (trash being the default on soft delete).

**Data Integrity & Performance:** AstroPress uses transactions to ensure data integrity for multi-step operations (e.g., creating a post also involves adding default metadata and term relationships). Indices are added on common query fields:
- Index on `(post_type, post_status, post_date)` for fetching lists of posts by type/status and sorting by date.
- Index on `post_name` (slug) for quick lookup by slug (unique per type).
- Index on `post_parent` for efficiently querying child pages or attachments of a post.
- Index on `post_author` for author archives.
These mirror or improve upon WordPress’s default indexes. Also, `comment_count` and similar denormalized fields (like term counts in the term_taxonomy table) are maintained in sync via application logic or triggers, ensuring fast access to aggregated data without expensive runtime calculations.

**Users and Roles:** The `users` table (like `wp_users`) stores registered users:
- Fields: `ID`, `user_login` (username), `user_email`, `user_pass` (hashed password), `user_nicename` (slug for URLs), `display_name`, `user_registered` (date), plus `user_status` and `user_url`.
- AstroPress stores passwords hashed with a strong algorithm (bcrypt/argon2) rather than the older WP hashing (which was already salted but we use modern libraries).
- The `users` table doesn’t directly include role information. Instead, AstroPress manages roles and capabilities separately. In WordPress, roles/caps are stored in `wp_usermeta`. AstroPress introduces dedicated structures:
  - A `roles` table defines roles (Administrator, Editor, etc.) and possibly a JSON or separate table for capabilities per role.
  - A join table `user_roles` links user IDs to role IDs (allowing multiple roles per user if ever needed, though by default each user has a single primary role).
  - Alternatively, AstroPress can serialize the capabilities array in usermeta for compatibility, but internally a structured table is easier for queries and management.
- Additionally, `usermeta` table stores arbitrary user metadata (like first_name, last_name, description, session tokens if any, application passwords, etc.), similar to `wp_usermeta` with `user_id`, `meta_key`, `meta_value`.

**Responsibilities:** The User system handles:
- Authentication (verifying credentials against `user_pass`).
- Password changes (hashing new password and storing).
- Tracking roles and capabilities for each user (what they can do).
- User registration and profile updates.
- Ensuring sensitive data is protected (e.g., `user_pass` never exposed via API; some fields like email only visible to authorized requests).
- The roles define what actions a user can perform across the system (enforced in the Auth subsystem and relevant service logic).

**Relationships & Interfaces:** Users are referenced by many parts of the system:
- Posts reference a user as author.
- Comments can reference a user if the comment is by a logged-in user.
- The REST API `/wp-json/wp/v2/users` and `/wp-json/wp/v2/users/{id}` allow admin to list or get user details. The GraphQL schema provides a `User` type and perhaps a query field like `users` (which in WPGraphQL might only be accessible with proper permissions).
- Roles and capabilities are not directly exposed via REST by default (WordPress doesn’t expose all roles list via REST for security), but AstroPress could have an admin-only endpoint to list or manage roles.

**Data Integrity & Security:** Each user’s roles are consistent through the join table and enforced: e.g., if a user’s role is changed from Author to Contributor, the capabilities they have immediately change in permission checks. The system may cache roles in memory for quick lookup. Password storage uses secure hashing with a salt (if using bcrypt, the salt is embedded; if argon2, similarly). On login attempts, AstroPress uses constant-time comparison to prevent timing attacks and may implement brute force protection (like exponential backoff or IP-based throttling via middleware). Sensitive user meta (like application passwords or auth tokens) are stored hashed if applicable and only accessible by admin or the user themselves.

**Comments:** The `comments` table (like `wp_comments`) stores comments on posts:
- Fields: `comment_ID`, `comment_post_ID` (FK to posts), `comment_author` (name), `comment_author_email`, `comment_author_url`, `comment_author_IP`, `comment_date` (& GMT), `comment_content`, `comment_approved` (approval status: 0, 1, or spam), `comment_parent` (for threaded comments, FK to another comment), `user_id` (FK to users table if the comment author is a registered user).
- A `comment_meta` table holds comment metadata (similar structure to other meta tables).

**Responsibilities:** The Comments system manages user feedback content:
- Storing new comments (either from unauthenticated users providing name/email, or from logged-in users).
- Moderation status: new comments might be auto-approved or held pending based on configuration (e.g., if the site requires moderation for first-time authors, etc.). AstroPress can enforce the same rules (perhaps configurable or following WordPress’s options like `comment_moderation` and `comment_whitelist` which we’d store in options table).
- Threading: comments can be nested. When retrieving comments via API, AstroPress can either return them flat with parent IDs (like the WP REST API does, letting the client build the tree) or in hierarchical order. The REST API by default returns a flat list sorted by date with parent property; GraphQL could allow hierarchical querying.
- Counting: AstroPress maintains the `comment_count` in the posts table to reflect number of approved comments for each post (updated when comments are added/removed or change approval status).
- Spam vs Trash: AstroPress can incorporate an Akismet-like spam check via plugin, but core will at least support marking comments as spam or trash (perhaps reusing `comment_approved` values used by WP: 'spam' or a special flag).
- Notifications: If configured, when a comment is posted, the system triggers an event that could email the post author or moderator (mirroring WP’s behavior controlled by options `comments_notify` etc.). The plugin system can hook into the comment submission to handle notifications.

**Interfaces:** Comments are exposed via REST (`/wp-json/wp/v2/comments`) with standard operations (list, create, get, update (for moderation or editing), delete). The list can be filtered by post, author, status, etc. In GraphQL, a `Comment` type is defined and posts have a `comments` connection field for querying comments. Only users with proper rights can list all comments (e.g., an admin can fetch all comments, a normal user might only fetch approved comments or their own). Posting a comment via API does not require auth if open (just like WP allows public commenting), but AstroPress will enforce CAPTCHAs or other anti-spam measures via plugin if needed, or at least throttle to prevent spam.

**Data Integrity & Performance:** Indices on `comment_post_ID`, `comment_approved`, and `comment_parent` help fetch comments by post and handle threaded lookups efficiently. When listing comments for a post, AstroPress will query only approved comments (unless the requester is an admin or the post’s author asking for unapproved as well). For thread depth, the system can limit the depth (configurable, default 5 like WP). If needed for performance, AstroPress can cache the number of comments per post (which it already does via comment_count) and possibly cache recent comments queries. Bulk deletion of a post triggers deletion of its comments (cascading in the database or handled by service logic, ensuring no orphan comments remain).

**Terms and Taxonomies:** WordPress categorizes content with a flexible taxonomy system. AstroPress implements:
- `terms` table (`wp_terms`): `term_id`, `name`, `slug`, `term_group`.
- `term_taxonomy` table (`wp_term_taxonomy`): `term_taxonomy_id`, `term_id` (FK to terms), `taxonomy` (e.g. category, post_tag), `description`, `parent` (for hierarchical taxonomies), `count` (number of posts assigned to this term).
- `term_relationships` table: `object_id` (e.g. post ID), `term_taxonomy_id` (links to a term in a taxonomy). This associates posts with terms.
- `term_meta` table: (if needed, similar to other meta tables) for storing arbitrary metadata about terms.

This separation (terms vs term_taxonomy) is a WordPress quirk to allow the same term name to be used in multiple taxonomies without duplication. AstroPress can maintain this structure for compatibility, including updating the `count` field whenever relationships change.

**Responsibilities:** The Term/Taxonomy system handles:
- Defining taxonomies (by default “category” and “post_tag” for posts). Categories are hierarchical (can have parent/child), tags are flat.
- Assigning terms to posts (when a post is created or updated with certain categories/tags).
- Creating new terms (e.g., when an Editor adds a new category via API).
- Ensuring the `count` of posts per term is updated (e.g., if a post is published or removed or its terms changed).
- Deleting terms (if no longer used or via explicit request) and cleaning relationships.
- Possibly supporting custom taxonomies via plugins (e.g., a plugin registers a “Genre” taxonomy for posts – the system would then allow terms in that taxonomy to be created and assigned, and expose them via API).

**Interfaces:** 
- REST API endpoints: `/wp-json/wp/v2/taxonomies` (for taxonomy definitions), `/wp-json/wp/v2/categories` and `/wp-json/wp/v2/tags` (for terms in those taxonomies), and similar for any custom taxonomy (the route is typically the taxonomy name, pluralized). They support GET (list terms, single term), POST (create term), PUT (update term), DELETE (delete term) for authorized users.
- GraphQL: WPGraphQL exposes each taxonomy as either a separate type or as part of a union. AstroPress would have a `Category` type and `Tag` type (implementing a common interface perhaps), and Post type will have fields like `categories` (Category connection) and `tags` (Tag connection). Also root query fields like `categories` (to list all categories).
- The system also uses the term data internally, e.g., when querying posts by category, it will join through these tables.

**Data Integrity & Performance:** 
- The combination of `terms` and `term_taxonomy` is managed such that if a term is created in a taxonomy, an entry exists in both tables. AstroPress could simplify internally (since we have full control, one could merge them into one table in a new system). However, to mirror WP exactly (for potential direct DB compatibility), AstroPress keeps them separate. It will ensure to create both records when adding a new term.
- Indices: on `term_taxonomy(taxonomy, term_id)` and on `term_relationships(object_id, term_taxonomy_id)` for efficient retrieval. A query like “all posts in category X” translates to finding term_taxonomy_id for category X and then finding all object_ids in term_relationships with that term_taxonomy_id (indexed).
- The `count` field in term_taxonomy is updated in a transaction whenever term relationships change. For example, when publishing a post with certain categories, the counts for those categories are incremented; if the post is later trashed or its category removed, counts decrement. This mirrors WP behavior (and ensures that if an API client requests category info, the count field is accurate).
- For hierarchical taxonomies (like categories), retrieving terms via API can include children. AstroPress can either return all and let client figure hierarchy (as WP REST does, with each term including parent ID), or provide parameters to fetch tree. Typically, WP REST offers `?per_page=100&hierarchical=true` which still returns flat but clients often build tree. AstroPress will supply parent IDs in responses for hierarchy information.

**Media (Attachments):** Media files are treated as a type of post (`post_type='attachment'`). In the `posts` table, attachments have:
- `post_mime_type` set (e.g. image/jpeg, application/pdf).
- `post_parent` linking to a post if the media was uploaded to a particular post (e.g., attached to its content).
- A GUID often equal to the file URL.
- Title and content/excerpt can act as the media title and caption/description.
- Associated metadata stored in `post_meta`: e.g., `_wp_attachment_metadata` (an array of image dimensions, thumbnail URLs, etc.), `_wp_attachment_image_alt` for alt text, `_wp_attached_file` for the file path.

AstroPress uses this same approach:
- The `Media` service handles the details of file storage and metadata creation. When a file is uploaded, an attachment post entry is made and relevant meta populated.
- The actual binary files are stored outside the database. By default, AstroPress will use the local filesystem (e.g., an `uploads` directory, often structured by year/month as WP does, configurable base path). The path or filename is stored in a known meta field (`_wp_attached_file`).
- If configured to use S3, the Media service, instead of saving to local disk, will upload the file to S3 and store the remote URL or object key in place of the local path. The `source_url` returned via API would then be the S3 URL (or a CDN URL if configured).

**Responsibilities:** 
- **Upload Handling:** Accept file upload streams (via REST POST /media endpoint, which will carry a multipart form with file data). The server will save the file (local or S3), ensure it’s accessible, and create the attachment post entry. It generates various image sizes if image (thumbnail, medium, etc., based on a configurable sizes list, default matching WP sizes). Those generated files are also saved and referenced in the `_wp_attachment_metadata`.
- **Serving Media:** For local files, AstroPress can use Express static middleware or a dedicated route to serve files from the uploads directory. For S3, clients will get a URL pointing directly to S3 (or a proxy if needed).
- **Media Metadata:** Extract metadata like image width/height, duration for videos, etc. The system might use libraries (e.g., Sharp for images) to get this data. This info is stored in the DB (post meta) and returned in REST API’s `media_details` field for images (just like WP includes dimensions and sizes URLs).
- **Cleanup:** If an attachment is deleted via API (DELETE /media/:id), the system will remove the file from storage (delete from disk or S3) and remove the DB entries (post + meta). If a post is deleted, optionally its attached media might be deleted or left unattached (WP by default leaves attachments orphaned unless specifically deleted, but AstroPress could offer an option to cascade delete media with the post).

**Interfaces:** 
- REST: `/wp-json/wp/v2/media` supports GET (list media library, typically requires auth or only exposes publicly attached media if unauthenticated), POST (upload new media), GET by ID, PUT (update metadata like title or alt text), DELETE (delete media item).
- GraphQL: likely a `MediaItem` type with fields like `sourceUrl`, `mimeType`, `mediaDetails { width, height, sizes{…} }`, etc. Queries can fetch media by ID or through connections (e.g., a post’s `featuredImage` field returns a MediaItem).
- When posts are returned via REST, the `featured_media` field is an ID linking to a media item, and AstroPress’s REST will populate `_links.wp:featuredmedia` and (if `_embed=true`) include the full media object. GraphQL will allow nesting to get the featured image in one query.

**Extensibility:** Media handling can be extended via:
- Support for additional storage providers via plugins (implementing the interface for saving/deleting files).
- Filters on upload (a plugin could intercept an image upload to perform compression or add watermarks).
- Defining additional image sizes or transformations (exposed via configuration or plugin).
- Security scans: a plugin could hook into the upload process to scan files for viruses or disallowed content.

**Performance & Considerations:** 
- Serving media is largely IO-bound. If using local storage, serving directly via a static file server (or CDN in front) is optimal. AstroPress might offload heavy image resizing to background jobs if the image is very large to avoid delaying the API response (WordPress sync generates sizes, but that can slow the response; AstroPress could choose to generate sizes asynchronously and in the meantime return the original).
- The media listing in the library (GET /media) might be heavy if thousands of images; we page and possibly don’t load metadata for all items unless requested (like WP does not embed all size URLs unless needed).
- Proper cache headers can be used for media responses (since files are static, set far-future expires headers, etc., perhaps leaving that to the CDN layer).
- In the database, attachments are just posts, so queries filtering out attachments (like listing only real posts) should always include `post_type='post'` or relevant, which our queries do. We also index `post_type` so selecting attachments specifically or excluding them is efficient.

**Metadata (Post Meta, etc.):** WordPress’s flexible metadata system is preserved:
- `post_meta` (wp_postmeta): stores arbitrary key-value pairs for posts. Columns: `meta_id`, `post_id`, `meta_key`, `meta_value`.
- `user_meta`, `comment_meta`, `term_meta`: similar structure for users, comments, terms respectively.

AstroPress heavily relies on meta for extensibility and storing additional info. Core usage examples:
- Post meta: custom fields, featured image `_thumbnail_id`, attachment metadata, SEO meta, etc.
- User meta: roles/capabilities (if using WP-compatible storage), session tokens for auth (WP stores cookies hashes in usermeta sometimes), profile information.
- Comment meta: less used in core, but plugins may use (e.g., ratings on comments).
- Term meta: could store term-specific settings (like an image for a category).

**Responsibilities:** 
- Provide CRUD operations for meta tied to the object’s lifecycle (delete meta when owning object is deleted).
- Enforce that only authorized actions can update certain meta (for example, WordPress protects some meta keys with capabilities or by marking them as internal). AstroPress can implement a safeguard where meta keys starting with "_" are considered private and only updatable by certain roles.
- Support querying by meta in REST (WP REST API allows filtering posts by meta key/value if enabled via a plugin; AstroPress can offer it as well).
- The plugin system can define new meta keys and use them, so the meta system must be robust and efficient.

**Performance:** Meta tables can grow large (especially post_meta). We ensure:
- Index on `post_meta(post_id)` and on `post_meta(meta_key)` (MySQL in WP had index on meta_key with length 191; in PG we can index full text if needed). This helps queries that filter or join by meta (like finding all posts where meta_key=foo and meta_value=bar, though that might also need indexing meta_value if often searched).
- Possibly use partial indexes for specific frequently queried keys (e.g., an index on meta_value of `_thumbnail_id` if we often query by that, though usually we get by post ID, not search by value).
- AstroPress’s data access layer can batch meta queries: e.g., when loading a post, fetch all its meta in one query rather than one per key. We can even join some meta directly if needed (like left join posts and post_meta for a particular meta_key if always needed, such as joining `_thumbnail_id` to include featured image ID in one go).
- Object caching: frequently, WordPress solves repeated meta lookups by caching all meta for a post on first request. AstroPress can do similarly in the Posts service (store meta in a cache object attached to the post during the request lifecycle).

**Options (Settings):** The `options` table (wp_options) holds site-wide settings:
- Columns: `option_id`, `option_name`, `option_value`, `autoload` (boolean).
- AstroPress uses this for configuration that needs to be editable at runtime: site title/tagline (`blogname`, `blogdescription`), admin email, any plugin settings that are site-scoped, the active theme (`stylesheet` and `template`), list of active plugins (`active_plugins`), and AstroPress-specific toggles (like “graphql_enabled” perhaps, or OAuth keys if not stored as env).
- On startup, AstroPress can preload all `autoload = true` options into memory (just like WP does) ([The Ultimate Developer's Guide to the WordPress Database](https://deliciousbrains.com/tour-wordpress-database/#:~:text=)). This includes crucial settings and improves performance by avoiding DB hits on each usage.
- Option updates (via an admin API or internal logic) update the DB and in-memory cache.

**Responsibilities:** The configuration system ensures that:
- Defaults are set for required options on first run (like default role for new users, etc.).
- Only authorized users (Administrators) can update sensitive options (e.g., changing site URL, managing plugin list, etc.).
- Options changes can trigger effects: e.g., changing timezone option will affect how dates are output; changing active_plugins causes Plugin Manager to possibly load/unload plugins (though typically you’d use the plugin activation endpoint instead of directly flipping that option to ensure proper loading).

**Interfaces:** A REST endpoint `/wp-json/wp/v2/settings` exists in WP (for Jetpack and Gutenberg usage) that returns a subset of site settings and allows updating them. AstroPress can implement this for parity, requiring administrator auth. GraphQL might have a `generalSettings` type for site title, etc., and a mutation to update settings (WPGraphQL has such fields).

**Data Integrity:** Options are simple key-value, so not much relational integrity needed. We ensure unique index on `option_name` so no duplicates. The `autoload` flag is honored by caching logic.

---

Overall, AstroPress’s database schema and data model align with WordPress so that all data can be represented and managed similarly. This lays the groundwork for the API layer to present a WordPress-compatible interface. Additionally, AstroPress makes improvements (stronger data typing, constraints, and indexing; potential use of transactions and background tasks for maintenance) to increase robustness and performance while preserving the expected behaviors of a WordPress site.

## WordPress REST API Module (REST Interface)

AstroPress implements the **WordPress REST API** on top of the new stack, providing a drop-in replacement for WordPress’s `wp-json/wp/v2` REST endpoints. The REST API module is responsible for routing HTTP requests to the appropriate logic, enforcing the correct permissions, and formatting responses exactly as WordPress would. This ensures that headless front-ends or third-party applications written against the WP REST API will work unchanged with AstroPress.

### Purpose and Scope

- **Purpose:** To expose WordPress-like RESTful web service endpoints for all core content and operations. This includes content retrieval (GET requests for posts, pages, etc.), content creation/modification (POST/PUT/PATCH to create or update resources), and deletions (DELETE requests), as well as supporting actions like user authentication, and site settings retrieval.
- **Scope:** All standard WP REST API endpoints with 1:1 parity:
  - **Content Endpoints:** Posts (`/wp/v2/posts`), Pages (`/wp/v2/pages`), Media (`/wp/v2/media`), Categories (`/wp/v2/categories`), Tags (`/wp/v2/tags`), Comments (`/wp/v2/comments`), Users (`/wp/v2/users`), Taxonomies (`/wp/v2/taxonomies`), Post Types (`/wp/v2/types`), Post Statuses (`/wp/v2/statuses`), etc. Each of these includes standard methods (GET for list or single, POST for create, etc.) consistent with WP.
  - **Authentication support:** While WP REST API by itself relies on external auth (cookies or tokens), AstroPress will provide an authentication endpoint (e.g., `/wp-json/jwt-auth/v1/token` if mimicking the JWT plugin, or an AstroPress-specific login route) to obtain a token. It will also accept authentication information in requests (Authorization header or cookies) and validate accordingly.
  - **Administrative Endpoints:** WordPress doesn’t expose plugin/theme management via REST by default, but AstroPress will add endpoints in a custom namespace (e.g., `/astropress/v1/plugins`) for such operations (discussed later in Admin Tools). The REST API module will handle those as well, though they are outside the `wp/v2` namespace.
  
In short, any URL under `wp-json/wp/v2/...` that WordPress would handle, AstroPress handles too.

### Routing and Request Handling

AstroPress uses Express to define routes matching the WP REST URL structure:
- It mounts an Express router at `/wp-json/wp/v2`. Within it, routes for each resource type are defined. For example:
  - `GET /posts` -> list posts
  - `POST /posts` -> create post
  - `GET /posts/:id` -> retrieve a single post by ID
  - `PUT/PATCH /posts/:id` -> update post
  - `DELETE /posts/:id` -> delete (trash) post
  - Similarly for other resources: `/comments`, `/users`, etc. (Note: some endpoints have slightly different naming, e.g., `/categories` and `/tags` instead of a generic terms endpoint).
- For sub-collection routes: e.g., `/posts/:postId/revisions` or `/posts/:postId/comments` if implemented, the router handles those as well.
- Each route has an associated handler function. AstroPress organizes handlers by resource type (like a PostsController with methods index, create, show, update, delete).
  
**Example:** When a request comes to `GET /wp-json/wp/v2/posts?per_page=5&author=2`, Express matches the `/posts` route and calls the Posts controller’s listing method. This method will:
  1. **Authenticate (if needed):** For a public GET, authentication isn’t strictly required, but if a token is provided, it will identify the user (which matters for contextual data like seeing private posts). The module uses a middleware earlier in the chain to parse `Authorization` header or cookies and set `req.user` if valid.
  2. **Parse Query Parameters:** e.g., `per_page=5`, `author=2`, etc. Validate them (per_page within allowed range, etc.) and pass them to service layer.
  3. **Call Business Logic:** e.g., `PostsService.list({ author: 2, limit: 5, offset: 0, status: 'publish', context: 'view' }, currentUser)`. The service will perform the DB query and return a list of posts.
  4. **Apply Response Filters:** The raw data from service is then formatted. The REST module will wrap each post object to include only the fields allowed for the request’s context (public vs edit context), apply any content filters (e.g., run the post content through autop/shortcodes if delivering rendered HTML).
  5. **Add metadata:** Set HTTP headers like `X-WP-Total` and `X-WP-TotalPages` based on the service’s results (if the service returned total count or we compute it). WordPress sends these for collection endpoints for pagination ([WordPress REST API · WordPress VIP Documentation](https://docs.wpvip.com/wordpress-on-vip/wordpress-rest-api/#:~:text=Caching)).
  6. **Embed links/embedded resources:** Construct the `_links` object for each item (self, collection, author link, replies link for posts). If the request had `_embed=true`, it will also fetch and embed related resources (author object, featured media object, etc.) in an `_embedded` field in the JSON.
  7. **Send JSON Response:** Use Express’s response to send the JSON array of posts. The HTTP status is 200. (Express automatically converts objects to JSON if `res.json()` is used.)

The output should match WordPress exactly. For instance, a post in the list might look like:

```json
{
  "id": 42,
  "date": "2025-04-16T18:25:43",
  "date_gmt": "2025-04-17T00:25:43",
  "slug": "hello-world",
  "status": "publish",
  "type": "post",
  "link": "https://example.com/hello-world",
  "title": { "rendered": "Hello World" },
  "content": { "rendered": "<p>... content ...</p>", "protected": false },
  "excerpt": { "rendered": "<p>... excerpt ...</p>", "protected": false },
  "author": 1,
  "featured_media": 10,
  "comment_status": "open",
  "ping_status": "open",
  "sticky": false,
  "template": "",
  "format": "standard",
  "meta": [], 
  "categories": [3, 7],
  "tags": [12],
  "_links": {
    "self": [{ "href": "https://site/wp-json/wp/v2/posts/42" }],
    "collection": [{ "href": "https://site/wp-json/wp/v2/posts" }],
    "author": [{ "href": "https://site/wp-json/wp/v2/users/1" }],
    "replies": [{ "href": "https://site/wp-json/wp/v2/comments?post=42" }],
    "version-history": [{ "count":1, "href": "https://site/wp-json/wp/v2/posts/42/revisions" }],
    "wp:attachment": [{ "href": "https://site/wp-json/wp/v2/media?parent=42" }],
    "wp:term": [
      { "taxonomy": "category", "href": "https://site/wp-json/wp/v2/categories?post=42" },
      { "taxonomy": "tag", "href": "https://site/wp-json/wp/v2/tags?post=42" }
    ]
  }
}
```

AstroPress ensures the presence and format of all these fields (_links, embedded IDs, etc.). Many of these fields come directly from the posts table or related tables. Some (like `meta` or custom fields) may require plugin support to appear.

### Authentication & Authorization in REST

All REST endpoints follow WordPress’s authentication and capability model:
- Public data (like published posts, publicly open comments) can be retrieved without authentication.
- Endpoints that list users, plugins, settings, etc., require an authenticated user with proper privileges (usually Administrator).
- The Express app will have an authentication middleware that runs before the REST routes. This middleware checks for:
  - **JWT token** in the `Authorization: Bearer <token>` header (if AstroPress issues JWTs for API auth).
  - **Application Password or Basic Auth:** if the header is `Authorization: Basic <base64>`, AstroPress can decode and verify against a stored application password (if that feature is enabled).
  - **Cookie + Nonce:** For compatibility, if AstroPress were used in a context with cookies (for example, if an existing WP front-end calls the API with logged-in cookies), we could validate WordPress auth cookies and X-WP-Nonce header. However, this is complex to reproduce exactly and likely not needed in a headless environment. Instead, we rely on tokens.
- After verifying credentials, the middleware attaches a `req.user` object (with user ID, roles, capabilities).
- Each route handler can then enforce authorization:
  - Example: A `POST /wp/v2/posts` requires the user to have the `publish_posts` capability (or if creating as draft, maybe just `edit_posts`). AstroPress will check `req.user.can('publish_posts')`. If false, it returns a 401 or 403 error with WP’s standard error shape (`{ code: "rest_cannot_create", message: "Sorry, you are not allowed to create posts as this user.", data: { status: 401 } }`).
  - Example: `GET /wp/v2/posts/42` for a draft post – if an unauthenticated user or a user who isn’t the author tries, AstroPress returns 404 as WP does (to not reveal its existence). If the author or an Editor/Administrator tries, it returns the post (with context=edit fields if the request includes `context=edit`).
  - Endpoints like `/wp/v2/users` require the user to have `list_users` capability (basically be an Administrator) to see all users. Otherwise returns 401.
- The **capability mapping** logic matches WordPress: e.g., to update a post, user needs capability `edit_post` (for that specific post). In WP, `edit_post` is a meta capability that maps to either `edit_posts` (if user is author of the post) or `edit_others_posts` (if not the author). AstroPress implements the same check in the Posts service or in an authorization helper. This ensures, for instance, an Author role user cannot edit someone else’s post (since they lack `edit_others_posts`).
- Any custom capabilities or differences introduced via plugins will be respected because the Auth system consults the central roles/capabilities data.

### Data Formatting and Response Consistency

One of the hardest tasks is to ensure the JSON output is exactly as expected. AstroPress’s REST module:
- Uses **the same field names and nesting** as WP. It consults the WP REST API schema (hardcoded or via reference) to include all fields. For instance, fields like `guid` and `meta` that WP includes (meta is empty array by default unless meta keys are registered) are also present.
- Implements computed fields: e.g., `link` (the permalink) – AstroPress can construct this if a site URL option is set, combined with the post’s slug and any hierarchy. Alternatively, it might leave `link` blank unless configured, but to mimic WP likely we compute it.
- **Contexts:** Many endpoints allow `?context=edit` for admins/authors which returns additional fields (like `post.content.raw` or unfiltered content, status, author, etc. are always given, but some fields like `meta` might only appear in edit context). AstroPress will check if `req.user` has permission to use edit context (basically can they edit this resource) and if so, include those fields. This matches WP’s behavior where e.g. a post in edit context includes the raw HTML content and other fields that are omitted in view context.
- **Dates and Timezones:** WP REST API by default returns `date` in the site’s timezone and `date_gmt` separately. AstroPress will do the same, converting timestamps appropriately based on the site’s timezone option.
- **Embedded resources:** If `_embed` query param is present, AstroPress will fetch related resources and include them. For example, embedding the author will place an entry in `_embedded.author[0]` that is the full user object for the author. It must also include embedded media, terms, etc. This requires additional queries, but AstroPress can optimize those by using batch fetches (e.g., if returning 10 posts with `_embed`, gather all distinct author IDs and query users once, all distinct featured_media IDs and query media once, etc., rather than one by one).
- **Error Handling:** AstroPress returns errors in the same format WP does. It will use appropriate HTTP status codes and a JSON body like `{"code":"rest_invalid_param","message":"Your request has an invalid parameter.","data":{"status":400,"params":{"search":"Search term too short."}}}` for example. We will carry over WP’s error codes (`rest_post_invalid_id`, `rest_user_cannot_view`, etc.). Developers relying on those codes or messages won’t have to change anything.

### Extensibility and Hooks (REST)

AstroPress’s REST API is built to be extensible, akin to WordPress’s REST API which allows plugins to register custom routes or modify responses:
- **Custom Routes:** Plugins can introduce new REST endpoints. In WordPress, `register_rest_route()` is used. AstroPress will expose a similar interface in its plugin API. When a plugin is activated, it can call something like:

  ```js
  AstroPressREST.registerRoute('myplugin/v1', '/do-something', {
    methods: ['POST'],
    handler: myHandlerFunction
  });
  ```

  The REST module will mount this route into Express (possibly by attaching to an “additional routes” router). The handler function can use AstroPress services or do custom logic. Permissions can be specified either inside the handler or via an options field (like WordPress has a `permission_callback` for routes).
- **Modifying Responses:** Provide hooks analogous to WP filters such as `rest_prepare_post`, `rest_prepare_user`, etc., which allow a plugin to filter the data right before it is sent. For example, a plugin might add a custom field to post responses. In WordPress, one could use `register_rest_field()` to add a field with callbacks for get/update. AstroPress can implement `registerRestField(type, fieldName, gettersetters)` so that the REST module, when preparing a response for that type, will call the provided getter to insert the field. This is how meta fields or ACF fields are often exposed in WP REST ([](https://www.wpgraphql.com/docs/wpgraphql-vs-wp-rest-api#:~:text=The%20WP%20REST%20API%20supports,This)).
- **Schema Extension:** The REST API provides a schema for each endpoint (accessible via OPTIONS request or the `/wp-json/wp/v2/posts/schema`). AstroPress can generate a similar JSON schema for each resource type. Plugins that add fields would extend this schema. While not heavily used by clients, maintaining it ensures completeness.
- **Middleware Hooks:** Perhaps allow plugins to add middleware for certain routes (e.g., to perform input sanitization or logging).
- **Versioning:** If WordPress updates to v3 of the API in future, AstroPress could support both `/wp/v2` and `/wp/v3` routes. The architecture could allow multiple sets of routes if needed, although initially only v2 is implemented.

### Performance Considerations in REST API

AstroPress’s REST API aims to be faster than WordPress’s PHP implementation:
- **Efficient Querying:** Because AstroPress uses a persistent process, it can cache prepared SQL or reuse DB connections across requests, reducing overhead. Complex GET requests that WordPress might handle via many PHP functions can be handled via optimized SQL joins or use of the data layer caching. For example, listing posts might be a single SQL query joining users and term relationships, rather than multiple queries.
- **Caching Responses:** AstroPress can implement an internal cache for GET responses. For instance, a GET of posts page 1 could be cached for a short period. On WordPress VIP, they cache REST GET responses by default for 1 minute ([WordPress REST API · WordPress VIP Documentation](https://docs.wpvip.com/wordpress-on-vip/wordpress-rest-api/#:~:text=Caching)). We can do similar: the REST module can integrate with a caching layer (like an in-memory LRU or Redis). When a GET request comes in, it forms a cache key (perhaps based on the endpoint and query params and maybe user role). If found, returns cached JSON, saving database work. When content is updated (via POST/PUT/DELETE), relevant cache entries are invalidated (e.g., editing a post clears the cache for the posts listing and that single post’s endpoint).
- **Compression & HTTP/2:** These are more deployment concerns, but enabling GZIP compression of JSON and using HTTP/2 multiplexing can significantly improve perceived performance. AstroPress will send compressed responses if the client supports it (Express can use compression middleware).
- **Pagination & large data:** For large collections, AstroPress enforces pagination (just like WP, with default 10 per page and max 100 per page). If a client requests an extremely high page number, AstroPress’s underlying query uses efficient offset or keyset where possible. We might implement an optimization: e.g., if a high offset is requested, and there's an indexed field like ID or date, we could do a seek using a `WHERE id < X` instead of `OFFSET` which is costly for very high offsets. But to preserve exact output ordering and because WP allows offset, we will likely stick to OFFSET but ensure proper indexing to mitigate it.
- **Concurrent Handling:** Node’s event loop can handle many simultaneous requests. For CPU-heavy tasks (like computing a large JSON, running a lot of filters on content), those could be a bottleneck. AstroPress can mitigate by not doing extremely heavy computation in the request thread (for example, avoid synchronous image processing here – which we do in media service asynchronously).
- **No PHP Startup Cost:** Each request in WP REST API boots up PHP and WordPress core, parsing lots of PHP files. AstroPress, being long-lived, has already loaded its code and just reuses it, cutting down response time significantly especially under load.

In summary, the REST API module ensures that any application expecting WordPress’s endpoints and data formats can work with AstroPress seamlessly. Meanwhile, developers can build new features on this API knowing they can hook and extend it just like in WordPress. With AstroPress, they gain performance, scalability, and a unified codebase (JavaScript) while retaining the familiar WP REST structure.

## GraphQL API Module (WPGraphQL-Compatible GraphQL Interface)

AstroPress optionally provides a GraphQL API that mirrors the functionality offered by the WordPress WPGraphQL plugin ([](https://www.wpgraphql.com/docs/introduction#:~:text=WPGraphQL%20is%20a%20free%2C%20open,47%20for%20any%20WordPress%20site)). This allows clients to query and manipulate WordPress data using GraphQL queries and mutations, which can be more efficient and flexible than REST in many scenarios. The GraphQL API is not enabled by default in a stock WordPress, but AstroPress includes it as a first-class feature (configurable to enable or disable).

### Purpose and Advantages

- **Purpose:** Expose the entire WordPress content model via a GraphQL schema, enabling clients to retrieve exactly the data they need in a single request and navigate relationships (like posts -> author -> other posts by that author) without multiple round trips. This GraphQL interface should be compatible with the WPGraphQL plugin’s expected schema so existing queries against WPGraphQL will work on AstroPress.
- **Advantages:** GraphQL allows:
  - **Selective Data Retrieval:** Clients specify the fields they want, so no over-fetching. For example, you can fetch a post’s title and author name without getting content or other fields ([](https://www.wpgraphql.com/docs/wpgraphql-vs-wp-rest-api#:~:text=This%20would%20include%20the%20posts%E2%80%99,unneeded%20data%20to%20be%20downloaded)).
  - **Nested Queries:** You can fetch a post and, within the same query, fetch its author’s details and the author’s other posts, all in one call ([](https://www.wpgraphql.com/docs/wpgraphql-vs-wp-rest-api#:~:text=With%20the%20WP%20REST%20API%2C,get%20a%20list%20of%20posts)) ([](https://www.wpgraphql.com/docs/wpgraphql-vs-wp-rest-api#:~:text=It%E2%80%99s%20now%20your%20responsibility%20to,information%20that%20you%20don%E2%80%99t%20need)). In REST, this would require multiple requests (one to /posts, then one to /users, etc.).
  - **Single Endpoint:** All queries and mutations go to `/graphql`, simplifying client usage (especially with GraphQL clients like Apollo).
  - **Strong Typing and Introspection:** Developers can introspect the schema and get auto-completion and type safety benefits. Tools like GraphiQL or Apollo’s codegen work out-of-the-box.
  - **Batch Resolution:** On the server side, GraphQL resolution can be optimized using batching (DataLoader), often resulting in fewer database queries than the equivalent REST pattern ([](https://www.wpgraphql.com/docs/wpgraphql-vs-wp-rest-api#:~:text=DataLoader%20and%20the%20n%2B1%20problem)).
  
### Schema Design

AstroPress’s GraphQL schema closely follows WPGraphQL’s schema:
- **Root Query Fields:** There are root fields for each major entity or connection:
  - `posts` (to query multiple posts, returns a `PostConnection` type with `edges` and `nodes`), and a corresponding singular `post(id: ID!, idType: PostIdType = DATABASE_ID)` field to retrieve a specific post ([](https://www.wpgraphql.com/docs/posts-and-pages#:~:text=Single%20Post%20by%20Global%20ID)) ([](https://www.wpgraphql.com/docs/posts-and-pages#:~:text=Single%20Post%20by%20Database%20ID)).
  - Similarly: `pages` and `page(id:...)`, `mediaItems` and `mediaItem(id:...)`, `comments` and `comment(id:...)`, `users` and `user(id:...)`, etc., as well as `categories`, `tags`, and generic `term` queries for custom taxonomies.
  - Possibly `generalSettings` for site options like title/tagline (WPGraphQL provides this).
  - `viewer` field representing the currently authenticated user (so a client can query its own identity and capabilities).
- **Types and Fields:** For each WordPress entity, a GraphQL Object Type:
  - `Post` type with fields: `id` (GraphQL ID, often a base64 global ID), `databaseId` (the numeric ID), `title`, `content`, `excerpt`, `slug`, `date`/`dateGmt`, `status`, etc., and relationships like `author` (which is a `User` type), `comments` (CommentConnection), `categories` (CategoryConnection), `tags` (TagConnection), `featuredImage` (MediaItem), `parent` (for page parent), `children` (for page children via connection), etc.
  - `Page` might be either its own type or simply a `Post` type with a different postType value. WPGraphQL typically has a unified `Post` interface and then separate types for specific post types if needed.
  - `User` type with fields: `id`, `databaseId`, `name`, `email` (maybe protected), `roles` (list of role names), etc., plus possibly connections like `posts` (posts authored by this user).
  - `Comment` type: `id`, `databaseId`, `content`, `date`, `author` (which could be either a User or a generic author object for guest comments), `parent` comment, `replies` connection.
  - `MediaItem` type: similar to Post but with fields like `sourceUrl`, `mediaDetails` (which contains sizes and dimensions), `altText`, etc.
  - `Category` and `Tag` types (or a more generic `Term` type with an interface since WPGraphQL does separate categories and tags into types but they share an interface). Fields: `id`, `databaseId`, `name`, `slug`, `description`, `posts` (connection of posts in that term).
  - These types implement interfaces like `Node` (with the `id` field), `ContentNode` (for Post/Page/Media common fields), `TermNode` (for Category/Tag common fields), etc. WPGraphQL has many such interfaces ([](https://www.wpgraphql.com/docs/default-types-and-fields#:~:text=Next%2C%20WPGraphQL%20registers%20Interfaces,Interfaces%20are%20registered%20by%20default)) ([](https://www.wpgraphql.com/docs/default-types-and-fields#:~:text=,NodeWithPageAttributes)) to allow generic queries. For example, there might be a union or interface for all post types.
- **Connections and Pagination:** All list fields and root list queries use the Relay-style connection pattern:
  - For example, `PostConnection` type has `edges` (array of `PostEdge` which has a `node: Post` and `cursor`) and `pageInfo` (with `hasNextPage`, `endCursor`, etc.).
  - Arguments for connections include `first`, `last`, `before`, `after` for cursor-based pagination, and also filtering arguments grouped in a `where` object (e.g., `where: { author: 2, categoryName: "Tech", search: "keyword" }` to filter posts ([](https://www.wpgraphql.com/docs/posts-and-pages#:~:text=,a%20specific%20author))).
  - The `where` args cover what WPGraphQL supports: by author, by term, by meta (if enabled), by date, search term, status (if user has privilege to query drafts), etc.
  - This design ensures we can fetch partial lists and continue via cursors, which is efficient for large data sets.
- **Mutations:** The schema defines mutations akin to WPGraphQL’s:
  - e.g., `createPost(input: CreatePostInput!): CreatePostPayload` ([](https://www.wpgraphql.com/docs/posts-and-pages#:~:text=Create%20Post)) ([](https://www.wpgraphql.com/docs/posts-and-pages#:~:text=%7D%29%20,)), `updatePost(input: UpdatePostInput!): UpdatePostPayload`, `deletePost(input: DeletePostInput!): DeletePostPayload`.
  - Similarly for other types: `createComment`, `updateComment`, `registerUser` (to create a user), `updateSettings` (for site options perhaps).
  - Each mutation input contains necessary fields (for createPost: title, content, status, etc., and clientMutationId for client tracking; WPGraphQL uses that pattern) ([](https://www.wpgraphql.com/docs/posts-and-pages#:~:text=Below%20is%20an%20example%20of,Mutation%20to%20create%20a%20post)). The payload typically returns the affected object (e.g., the created post node) and the same clientMutationId.
  - These allow full data manipulation via GraphQL, following the same permissions as the REST API.
- **Schema Introspection:** The GraphQL API supports introspection queries (GraphQL’s type system allows clients to query the schema itself). AstroPress generates the schema at runtime (or build time) and registers resolvers accordingly. This means developers can use GraphiQL (GraphQL IDE) to explore the available types and fields, which will show all core types and any extensions from plugins.

AstroPress will likely build this schema using a GraphQL library (e.g., Apollo Server with type definitions, or graphql-js to manually build types). The schema will be documented in the same way WPGraphQL’s schema is, and we might even reuse WPGraphQL’s naming conventions for types and fields exactly, to maximize compatibility. For example, WPGraphQL uses `databaseId` for the numeric ID, we do the same.

### Resolver Implementation and Data Fetching

Each field in the GraphQL schema has a resolver function that tells how to fetch that data. AstroPress’s GraphQL module will leverage the existing services and incorporate **batching**:
- We establish a GraphQL server (e.g., ApolloServer or express-graphql) and provide a `context` per request. The context will include references to AstroPress services (PostService, UserService, etc.), the current user (for auth), and DataLoader instances for batched loading.
- **DataLoader Batching:** We create DataLoader functions for common patterns:
  - `userLoader = new DataLoader(userIds => UsersService.fetchByIds(userIds))`
  - `postLoader = new DataLoader(postIds => PostsService.fetchByIds(postIds))`
  - `termLoader = new DataLoader(termTaxonomyIds => TermsService.fetchTermsByTaxonomyIds(termTaxonomyIds))` (or separate loaders per taxonomy).
  - etc.
  These loaders will be used in resolvers to defer actual DB calls until the batch is collected. This means if 10 posts are being resolved and each asks for `author` field, instead of 10 separate user lookups, DataLoader will collect all requested author IDs and do one call ([](https://www.wpgraphql.com/docs/wpgraphql-vs-wp-rest-api#:~:text=DataLoader%20and%20the%20n%2B1%20problem)). WPGraphQL cites this as a key performance gain over REST where 6 requests might be needed vs 1 GraphQL query ([](https://www.wpgraphql.com/docs/wpgraphql-vs-wp-rest-api#:~:text=With%20the%20WP%20REST%20API%2C,get%20a%20list%20of%20posts)) ([](https://www.wpgraphql.com/docs/wpgraphql-vs-wp-rest-api#:~:text=It%E2%80%99s%20now%20your%20responsibility%20to,information%20that%20you%20don%E2%80%99t%20need)).
- **Resolvers**:
  - For root query `posts(args)`: This resolver might directly call `PostsService.listPosts(filterArgs, paginationArgs, currentUser)` which returns a list of Post objects and also total count if needed. Then the GraphQL library will handle slicing according to `first/after` if using Relay-style. We need to convert that list to `edges` with cursors. Cursors could be based on the database IDs or an encoded offset. WPGraphQL likely uses the WP Relay cursor which is a base64 of something like `array( post_id, maybe type )`. AstroPress can mimic that encoding for consistency.
  - For field `Post.author`: Resolver receives parent post object and context. It will likely call `userLoader.load(post.authorId)`, returning a promise for the user. The DataLoader ensures all pending author loads are combined.
  - For field `Post.categories`: This needs to fetch terms for that post in category taxonomy. We can have a loader or just call TermsService.getTermsForObject(postId, 'category'). Possibly batch by gathering all postIds for which categories are requested. DataLoader can help: e.g., a loader that takes a list of (postIds, taxonomy) pairs. Or simpler, since GraphQL will call resolver for each post’s categories separately (though in practice DataLoader works best for single-key).
    * We might do without DataLoader by leveraging the fact that our PostsService when retrieving posts could optionally attach their terms to the object if asked. But since GraphQL chooses fields dynamically, we might just batch within the resolver: if categories field is being resolved for multiple posts concurrently, we could gather post IDs from parent objects and fetch all their category relationships at once (this is a bit advanced to coordinate outside DataLoader but possible).
    * Easiest might be a TermsService method that can take multiple postIds and return a mapping. Use DataLoader by key = taxonomy, and value = array of postIds? Possibly have one loader per taxonomy to fetch all posts terms.
  - For `Post.content` field: If we treat it as a scalar field, we might deliver the raw content or the rendered content. WPGraphQL typically provides raw content (since front-end could be responsible for rendering blocks). AstroPress could deliver raw HTML content (with block delimiters etc, exactly what’s stored in DB). Or we provide both via subfields: maybe `content(format: RENDERED)` argument to choose rendered vs raw. If not, we likely follow WPGraphQL’s decision (which I believe is raw content by default, and an option to render blocks on client).
  - For `Mutation.createPost`: Resolver will authenticate the user (context.user must have proper cap), then call `PostsService.createPost` with the input data. If successful, wrap the result in the payload type and return. If error (e.g., invalid data or permission), throw a GraphQL error with appropriate message. We ensure the same rules as REST for things like auto-draft creation, default values, etc.
- **Authorization within resolvers:** We incorporate checks:
  - The GraphQL server can use a schema directive or just in resolver code to ensure certain fields or mutations require auth. For example, the `users` query might check if context.user can list users, otherwise return an empty list or error.
  - Field-level: If a post is draft and the context.user doesn’t have access, the `post` query could return null or error. WPGraphQL might hide unpublished posts entirely unless authorized. We can do filtering in the service (so the post just wouldn’t be returned in a list if unauthorized).
  - We follow WPGraphQL’s approach: it likely simply doesn’t return unauthorized data. E.g., if querying a specific post by ID that’s draft and user not allowed, the resolver returns null (and GraphQL might put an error in extensions stating not authorized).
  - For simplicity, the PostsService might accept a `currentUser` and omit drafts they can’t see from any query results. So authorization is largely enforced at data fetch stage for queries. For mutations, it’s explicit in resolver.

### Integrating with Authentication

The GraphQL endpoint will use the same authentication token as REST:
- The client includes `Authorization: Bearer <token>` header with GraphQL requests (or cookie if we support cookie auth).
- The GraphQL context creation will parse that and attach the user (just like REST middleware).
- Thus, `context.user` is available to resolvers. Unauthenticated users get either no `viewer` data and limited query capabilities (e.g., can only query public data).
- We ensure that sensitive fields (like a user’s email) either have resolvers that check for self or proper capability before returning value (or else return null).

Additionally, AstroPress can implement GraphQL **persisted queries** or allow only POST. Typically, GraphQL should be POST for mutations and queries (though GET can be allowed for queries with query param, but we can restrict to POST for simplicity and to encourage use of tokens securely). Persisted queries (predefining queries with hashes) could be a future enhancement for security/performance.

### Extensibility (GraphQL)

Plugins can extend the GraphQL schema:
- If a plugin adds a new custom post type (e.g., 'Book'), AstroPress can extend the schema automatically or via plugin-provided SDL:
  - Possibly auto-generate a `Book` type with fields similar to Post, plus queries `books` and `book(id:)`.
  - Or require the plugin to provide type definitions and resolvers. The plugin system could expose a function like `extendGraphQLSchema(typeDefs, resolvers)` to merge into the existing schema.
  - WPGraphQL has an internal API for this (e.g., register_graphql_field in PHP). We would mimic that.
- Custom fields (like ACF fields) can be exposed by registering GraphQL fields for a type. For example, a plugin could register a field `Post.subtitle` with a resolver that fetches from post meta.
- New taxonomies: add corresponding types and link them to Post type.
- Perhaps even GraphQL directives or custom scalars if needed (e.g., WPGraphQL registers Date scalar, etc., which we would already have).
- The GraphQL module likely will need to rebuild or extend the schema when plugins activate. If using ApolloServer, we might create the initial schema and then on plugin activation, call `server.stop()`, rebuild schema, `server.start()` or use schema stitching. Alternatively, require a restart of server on adding new types if hot-swapping is complex. But given AstroPress is developer-focused, a restart on new plugin might be acceptable, though ideally not necessary.
- We will also allow plugins to protect their fields with custom auth logic if needed (like maybe a field that only some roles should see, plugin can code that in resolver).

### Performance Considerations for GraphQL

GraphQL, if not handled properly, can be heavy. AstroPress addresses this:
- **Query Planning & Batching:** Using DataLoader ensures that even complex nested queries only produce minimal DB queries. For example, a query asking for 5 posts and each post’s author and categories might result in:
  1 SQL query to get 5 posts,
  1 SQL query to get those 5 authors,
  1 SQL query to get categories for those 5 posts,
  rather than 1+5+5 in a naive approach.
  WPGraphQL notes this efficiency (fewer functions executed and less data sent) ([](https://www.wpgraphql.com/docs/wpgraphql-vs-wp-rest-api#:~:text=)) ([](https://www.wpgraphql.com/docs/wpgraphql-vs-wp-rest-api#:~:text=Another%20result%20of%20specifying%20exactly,significantly%20less%20data%20to%20download)).
- **Limiting Query Depth/Complexity:** AstroPress can enforce a maximum depth or complexity using available tools (Apollo has plugins for that). For instance, prevent a query that asks for posts -> author -> posts -> author -> ... infinitely. Or simply cap at, say, depth 5. Also possibly cap the `first` parameter in connections to a reasonable number by default (WPGraphQL might default to 10, and allow maybe up to 100 with a setting). We ensure queries can’t request tens of thousands of records in one go without pagination.
- **Caching:** While GraphQL queries can vary widely, AstroPress could cache results of identical queries for a short time. If using Apollo, we could implement an Apollo cache or use a persisted query mapping to allow caching. However, often the overhead is small enough and data can change frequently, so we rely more on the data loaders and DB caching layer.
- **Subscription and Live Data:** This spec does not implement GraphQL subscriptions (real-time updates). If needed, that could be an extension where AstroPress pushes updates via WebSockets. But WPGraphQL doesn’t cover that yet, so we align with it (queries and mutations only).
- **Parallel vs Serial resolution:** GraphQL executes field resolvers in parallel where possible. Because all our resolvers use async operations (promises to DB), Node can handle them concurrently. If some part is CPU heavy (not likely except maybe huge JSON serialization), Node might handle concurrently up to its single-thread limits. We could cluster the GraphQL server if needed (multiple processes behind a load balancer) to scale CPU.

### Example GraphQL Query Flow

Consider a GraphQL query:
```graphql
query GetHomeData {
  posts(first: 5, where: {orderby: { field: DATE, order: DESC }}) {
    nodes {
      title
      date
      author {
        node { name, avatar { url } }
      }
      categories {
        nodes { name }
      }
    }
  }
}
```
1. **posts resolver**: calls PostsService.listPosts with limit 5, order DESC by date. Returns array of 5 Post objects (with fields like title, date, authorId, etc.). No DB query yet if using DataLoader approach until trying to resolve fields? Actually, we likely do the DB query here to get posts.
2. GraphQL iterates through each post in `nodes`:
   - For each `Post.title` field, trivial resolver returns the title string (already have it).
   - For each `Post.date`, returns the date (maybe formatting if needed).
   - For each `Post.author`: calls DataLoader userLoader with the authorId. The first call triggers the loader to hold that ID; by the time it sees all 5 posts’ author resolver called, it has collected all unique author IDs (maybe some are same if same author wrote multiple). Then userLoader triggers a single UsersService.fetchByIds query. It returns user objects, which are then returned for each author field. The subfield `name` and `avatar.url` of User are resolved from the user object (avatar might be another DataLoader for user meta or a computed URL from some meta; if needed, that can be another batch).
   - For each `Post.categories`: calls categoryLoader with the postId. Suppose out of 5 posts, two have categories already fetched? But likely, we gather 5 post IDs and taxonomy 'category', do one query to get all categories for those post IDs, grouped by post. The resolver then returns an array of Category objects for each post. Those Category objects then resolve the `name` field easily.
3. The final result is assembled and returned as JSON.

All permission checks in this example: since it’s presumably public query (no sensitive data), none specifically needed beyond ensuring only published posts are fetched by PostsService.listPosts by default.

### Security in GraphQL

The GraphQL API adheres to the same security model:
- If a field or query would expose something the user shouldn’t see, the resolver omits it or returns null. For example, if an unauthenticated user queries `users { email }`, our User resolver for email will likely return null or error unless `context.user` is admin or requesting their own email.
- Mutations require authentication. If a mutation is called without a valid user or with insufficient role, the resolver returns a GraphQL error (which would be surfaced in the `errors` array of the response). We use messages similar to WP (“You are not allowed to do that”).
- We ensure that even though GraphQL exposes one endpoint, introspection doesn’t reveal any data, only schema. And since schema includes all types (including possibly ones for private data like user’s capabilities), we consider if any should be hidden. Generally it’s fine because knowing a type exists (like `User.email`) doesn’t give the data unless you are allowed to query it.
- Rate limiting GraphQL queries might be necessary if abuse is a concern (since a single query can be expensive). We could integrate a rate-limit by IP or by token, similar to REST.
- All GraphQL requests should be over HTTPS to protect tokens in transit.

In conclusion, the GraphQL module in AstroPress offers a powerful interface for clients that desire more control and efficiency than REST. It is built to match the WPGraphQL expectations, ensuring that a frontend like Gatsby or Apollo Client that worked with WPGraphQL on a WordPress site can work with AstroPress’s GraphQL with minimal or no changes. At the same time, AstroPress’s implementation leverages caching and batching to keep responses fast and resource usage optimal.

## Authentication and Authorization System

A secure and extensible **authentication & authorization** system is core to AstroPress. It manages user login and permissions, ensuring that only authenticated users can perform restricted actions and that each user’s capabilities (what they can do) mirror WordPress’s roles and capabilities model. This subsystem covers user credential verification, session/token management, and enforcement of WordPress-like permission checks across the platform.

### Purpose and Overview

- **Authentication** confirms the identity of a user (e.g., via password or external provider), issuing a proof of identity (like a token or session).
- **Authorization** determines if an authenticated user (or any user) has permission to execute a given action or access certain data, based on their role/capabilities.
- AstroPress’s auth system preserves WordPress concepts: users have roles (Administrator, Editor, Author, Contributor, Subscriber) which bundle capabilities (permissions) ([Roles and Capabilities – Documentation – WordPress.org](https://wordpress.org/documentation/article/roles-and-capabilities/#:~:text=WordPress%20has%20six%20pre,functions)) ([Roles and Capabilities – Documentation – WordPress.org](https://wordpress.org/documentation/article/roles-and-capabilities/#:~:text=,can%20write%20and%20manage%20their)). It also allows granular capability checks similar to WordPress’s `current_user_can()`.

Key features:
- **Password-based Login:** Users can authenticate with username and password, which AstroPress verifies against the stored hash.
- **Token-based Auth:** Upon successful login, AstroPress issues a JSON Web Token (JWT) or similar token that the client uses for subsequent requests (typically via Authorization header). This is stateless and ideal for APIs.
- **Optional Session Cookies:** If AstroPress is used with a traditional web frontend on the same domain, it could also support setting a secure HTTP-only cookie for the session. (Though primary usage is headless with tokens.)
- **OAuth 2.0 Login (Optional):** AstroPress can integrate with external OAuth providers like GitHub, Google, etc. When enabled and configured, users can log in via those providers, and AstroPress will map them to an AstroPress user account.
- **Roles and Capabilities:** The system enforces the role-based permissions for every action. Roles and their capabilities can be customized via configuration or plugins (just as WP allows adding roles or caps).
- **Application Passwords:** For API access without OAuth or web login, AstroPress can support WP-style Application Passwords ([WordPress REST API · WordPress VIP Documentation](https://docs.wpvip.com/wordpress-on-vip/wordpress-rest-api/#:~:text=Caching)) – basically secondary passwords (tokens) that a user can generate for API use. These are stored hashed and can be revoked. They allow Basic auth usage.
- **Extensibility:** A plugin could add SSO with an enterprise system, or enforce 2FA on login, etc. The auth system provides hooks (e.g., “pre_login” filter, “user_login” action, “user_logout” action, filter to approve/deny login attempts, etc.). Also, new roles or capabilities can be defined by plugins.

### User Credentials and Login Process

**Password Login:** 
- Users have a `user_pass` in the database which is a hash (using bcrypt with a cost factor, or Argon2id with appropriate memory settings). A salt is embedded in the hash output for bcrypt; Argon2 has its own scheme. This is an improvement over legacy PHPass used in WP but conceptually similar (WP also stores salted hashes).
- When a login request comes (e.g., `POST /wp-json/jwt-auth/v1/token` with username and password, or GraphQL mutation `login(username,pw)` if we add one):
  - The Auth system finds the user by username or email (we accept either, as WP does).
  - It retrieves the stored hash and uses a secure password verify function to check the provided password. This is done using a constant-time comparison to avoid timing attacks.
  - If the password is correct and the user account is active (not blocked), authentication succeeds. Otherwise, it fails (we do not reveal whether it was the username or password wrong, for security).
- On success, AstroPress creates an **auth token**. We prefer JWT (JSON Web Token):
  - The JWT payload includes user identification (user ID), maybe the user’s roles or capabilities, and an expiration timestamp.
  - It is signed with a secret key (configured on the server) using a strong algorithm (HS256 or RS256 if using an RSA key).
  - The token is returned to the client in JSON (e.g., `{ "token": "<jwt>", "user_email": "...", "user_nicename": "...", "user_display_name": "..." }` similar to popular WP JWT plugins).
  - The client will store this (e.g., in memory or secure storage) and include it on future requests.
- On subsequent requests, the Auth middleware will parse the JWT:
  - If valid (signature ok and not expired), it loads the user info. We might include roles in the token to avoid a DB lookup, but that means if roles change, token remains with old data until expiry. Alternatively, just include user ID and do a quick DB fetch of roles (which could be cached).
  - If the token is invalid or expired, request is treated as unauthenticated.
- Token expiration: We might set a short lifetime (e.g., 1 hour) and issue refresh tokens or allow re-login. Or set a longer life (e.g., 1 day) for convenience. Security vs convenience trade-off is configurable. If implementing refresh tokens, the login could return both an access token and a refresh token (the latter stored securely and used to get new access tokens).
- Logout: If using JWT stateless tokens, “logout” on client just means discarding the token. On server, we could maintain a blacklist of tokens if immediate revocation is needed (e.g., user clicks logout, we mark their current token as invalid until expiry). This could be done via an in-memory store of token IDs (if JWT includes a jti claim).
- Rate limiting: The login endpoint will implement a simple anti-bruteforce (like limit attempts by IP or user account). For example, no more than 5 failed logins per minute per IP or user. This can be done via an in-memory counter or small Redis.

**OAuth Login:** 
- When enabled, AstroPress acts as an OAuth client to providers:
  - Admin configures client ID/secret for e.g. Google OAuth and GitHub OAuth, and a redirect URI (pointing to an AstroPress endpoint like `/auth/google/callback`).
  - The user would initiate OAuth login (outside of AstroPress’s API, e.g., frontend redirects to Google’s auth URL with the client_id, etc.). Google then calls our callback with a code.
  - AstroPress’s OAuth callback endpoint (which could be an Express route separate from REST API, or within a special namespace) will:
    - Exchange the code for an access token (server-to-server call to Google’s OAuth API).
    - Use the access token to fetch the user’s profile info from Google (like email, name, possibly an ID).
    - Determine if this external user is already linked to an AstroPress user:
      - Perhaps store a mapping in the database (e.g., in user_meta: `google_id`).
      - If an AstroPress user with that google_id exists, that’s the user. If not, create a new user: generate a username (maybe from email or google username), mark a random password (since login via Google, password not needed unless they set one), assign a default role (configurable, e.g., Subscriber).
    - Generate an AstroPress JWT for that user and either redirect the front-end to include it (if front-end is our own, maybe we drop a cookie or show it) or return it in a response if this is an API-only usage.
  - Similar flows for GitHub or others.
  - Security: We treat OAuth login as equivalent to a password login in terms of trust, but we need to ensure we verify the provider’s token properly (using their SDK or endpoints). 
  - We also allow linking: a logged-in user could connect their account to an OAuth provider (store the mapping) so next time they can login via that provider and it hits the same account.
  - Admin can enable/disable which providers are allowed.

**Application Passwords (Basic Auth):** (if implemented)
- A user (likely an admin or any user for their own account) can create an application password (a 24-character random string) through an API or CLI. AstroPress stores a hash of it in user_meta (much like WordPress).
- The user can then use Basic Auth header with `Authorization: Basic base64(username:app_password)`.
- The Auth middleware, on seeing Basic, will detect if the password length/format corresponds to an app password (and not a normal password). It will then hash it and compare with stored hash in the DB for that user. If matches, auth succeeds as that user.
- These app passwords can be individually revoked or named for tracking (e.g., "My mobile app key").
- This provides a way to use the API without handling JWT. However, JWT is more common in modern setups.

### Authorization (Roles and Capabilities)

AstroPress’s authorization system is modeled after WordPress’s:
- Each user has one or more **roles**. Each role is associated with a set of **capabilities** (abilities like `read`, `edit_posts`, `publish_posts`, `edit_others_posts`, `manage_options`, etc.). WordPress defines default roles:
  - Administrator: essentially all capabilities ([Roles and Capabilities – Documentation – WordPress.org](https://wordpress.org/documentation/article/roles-and-capabilities/#:~:text=,who%20can%20only%20manage%20their)).
  - Editor: can publish/edit/delete any posts, manage categories, moderate comments, etc., but cannot manage sensitive settings or plugins.
  - Author: can publish/edit/delete their own posts only.
  - Contributor: can write drafts but not publish (requires review by Editor/Admin).
  - Subscriber: can read (which basically everyone can) and manage their own profile.
- AstroPress will load the **role definitions** on startup (from a JSON config or the database’s options where WP stores it). It ensures the default roles and caps exist if not present.
- The user’s role(s) are stored in the database. In WP, each user has a meta `wp_capabilities` (serialized array mapping caps to true). We might store similarly for compatibility, but our primary check can use a roles table and a roles-to-caps mapping.
- **Checking Capabilities:** Anywhere in the code we need to authorize, we use a function like `AuthService.userCan(user, capability, [maybe object])`. This function will:
  - Get the user’s effective capabilities. This can be derived from their role plus any additional caps (WP allows plugins to grant a single user a cap without role change, but that’s rare).
  - If the capability being checked is a meta capability (like `edit_post` or `delete_post` which apply to a specific post), map it to real capabilities:
    * e.g., `edit_post` for post ID 100 -> if user is author of 100, require `edit_posts`, if not author require `edit_others_posts`; also if post is published maybe need `edit_published_posts` if the user isn’t author and post is published (WordPress has such distinctions).
    * AstroPress can implement the same mapping rules WP does in its `map_meta_cap` function ([Roles and Capabilities – Documentation – WordPress.org](https://wordpress.org/documentation/article/roles-and-capabilities/#:~:text=The%20Super%20Admin%20role%20allows,user%E2%80%99s%20responsibilities%20within%20the%20site)).
    * For comments, `edit_comment` meta cap might map to `moderate_comments` or ownership check.
    * For terms, could have `edit_term` etc., mapping to caps like `manage_categories` (WP doesn’t fine-grain by default, except maybe with capabilities for custom taxonomies).
  - Then determine if the user has the required base capability. For example, to `publish_post`, the user needs `publish_posts` if it’s their own or `publish_posts` plus maybe a higher cap if not.
  - Administrator role has `everything` so usually passes all checks by a short-circuit.
- These checks are used:
  - In REST API handlers (as described) to return 401/403 or filter data.
  - In GraphQL resolvers to decide to return null or error.
  - In Plugin operations (only admins can activate plugins, which corresponds to capability `activate_plugins` in WP).
  - In Settings changes (capability `manage_options`).
  - Essentially anywhere WP would use current_user_can().

**Role Management:** 
- AstroPress can allow modifying roles via an admin API. E.g., an admin could create a new role or change capabilities (WP has functions add_role, remove_role, add_cap, remove_cap). We can expose this via a CLI or plugin, or by reading changes from configuration.
- By default, roles and caps are stored in the `options` table in WP (serialized). We might instead store them in structured tables, but to maintain easy compatibility, we could continue to use the `wp_user_roles` option (that’s what WP uses) which contains an array of roles and their caps. AstroPress can load that on startup if present. However, using a table is cleaner.
- We’ll ensure that at least one admin user exists (on install AstroPress would create an admin account like WP does).
- We also maintain that user 1 is the super admin (for single-site WP, admin is basically full admin; in multi-site WP, super admin is above admin, but we likely do not implement multi-site initially).

**Enforcement Points:**
- **REST Middleware:** After authentication, a middleware could check if `req.user` exists for endpoints that require it (like any writing operation). But often we handle it in the handler since it depends on resource (like maybe a user with lower role can still POST a comment, etc.).
- **Central Auth Service:** We have a unified place to ask “can this user do X?”. This could simply query a in-memory structure of caps loaded for that user. Could also apply any filter hooks (WP has a filter `user_has_cap` that plugins can override to, say, grant temporary cap).
- **Admin-specific**: The admin endpoints (plugin/theme management, user management, settings) will explicitly require `manage_options` or similar. Only Admin role has those by default.

**Password Security & Policies:**
- Storing strong hashes and using robust libraries protects passwords at rest. On login, after a successful password, we can re-hash with a stronger algo if the stored hash is from an older weaker scheme (e.g., if imported from WP which used PHPass, we could detect that and update to bcrypt).
- We may implement a password policy (min length, etc.) or allow plugins to enforce (WordPress doesn’t by default, aside from a strength meter in UI).
- Password reset: AstroPress can handle forgot password via a REST endpoint. For example, `POST /wp-json/wp/v2/users/lost-password` with email, which triggers sending an email with a token link. We’d need email sending configured (likely via SMTP or an email microservice). The reset link could point to an AstroPress endpoint that then accepts a new password and sets it. This flows outside core content but is part of user auth management. We mention that the system can integrate with email (via plugin perhaps) to send such mails. Since no UI, this might be done via an external UI calling API endpoints.

**Sessions:** 
- WordPress can maintain session tokens (and can invalidate others when a user changes password, etc.). With JWT, we don’t have server-stored sessions by default. If needed, we could maintain a list of active tokens or use JWT jti and a store to allow logging out from other devices.
- However, an easier route: if concerned about token misuse, keep tokens short-lived and require refresh. Logging out everywhere can then be done by changing a secret (so old tokens fail signature).
- Given the likely use-case (headless, each client stores its token and can be invalidated by just removing it), we might not need heavy session store.

### Plugin Hooks and Extensibility in Auth

AstroPress will allow customization of the auth process:
- **Filters on Login:** e.g., `pre_authenticate` hook can allow a plugin to override the authentication method. For instance, a plugin might check an SSO cookie and auto-auth the user without password. If that hook returns a user, AstroPress can skip normal password check.
- **Action on Login/Logout:** e.g., `user_login_success` (with user info, source = password or OAuth) for logging or post-login events (like updating last login time, which WP often stores in user_meta via plugin).
- **Custom Capabilities:** A plugin can introduce new capabilities (for example, WooCommerce adds capabilities like `manage_woocommerce`). AstroPress can accommodate this by treating them like any other string in the capabilities list. If not recognized, nothing in core checks them, but plugins will. We ensure storing and retrieving them is fine. Also we might define some mapping for meta caps if needed for new object types (like a plugin adds a custom post type with custom capabilities, our Auth should apply those similarly).
- **2FA Integration:** If a plugin wants to enforce two-factor auth, it can hook into login. For example, after password verification but before issuing JWT, it could check if user has 2FA setup and require an OTP code (maybe the login endpoint can be extended to accept an OTP and the plugin verifies it). Or the plugin could disallow login and respond with “require 2FA” status, then the client calls another endpoint to verify OTP which then completes login.
- **Password Hashing:** If an organization wants a different hashing algorithm or an external user store, a plugin could override the verify function to call an external API or use a different hash mechanism. AstroPress might allow plugging in a custom UserService for authentication.

### Security Considerations

The Auth system is designed for strong security:
- Hashing algorithms are strong and updated over time (we can include a mechanism to rehash an old password on login if the hash needs upgrading to a stronger scheme).
- No plaintext passwords ever stored or logged.
- Tokens (JWT) are signed with a secret that’s long and random. If using JWT, we must protect that secret (store in config not in code repo).
- JWT can include a nonce (jti) and we could set `aud` or `iss` claims to identify our site, adding context to the token to prevent misuse elsewhere.
- We encourage use of HTTPS so that tokens and credentials are not intercepted. If cookies are used for any reason, they should have Secure and HttpOnly flags.
- CORS: If front-end is on a different domain, our responses include appropriate CORS headers only allowing trusted origins to use the API, to reduce risk of token theft via XHR from malicious sites (though token should not be accessible to scripts if stored HttpOnly cookie).
- We likely disable JSONP or any less-secure transport in the API to avoid CSRF issues. Since we accept Authorization header tokens, CSRF is not an issue for state change requests as long as the token is secret from other sites.
- We ensure that user enumeration is limited: e.g., login error messages do not reveal if username exists. Also, default `/users` endpoint requires admin, so casual requests can’t list all users (which could be used to target usernames).
- The system could implement email verification on registration (if open registration is allowed, which by default WP can but it’s off by default except for subscriber signups). If we allow, we should ensure a verification step.

### Use in System Workflows

- **During a request:** The Auth middleware runs early, so by the time a request hits business logic, `req.user` (...