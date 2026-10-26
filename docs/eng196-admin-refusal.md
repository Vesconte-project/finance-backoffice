# Administrative shell admission — Part of ENG-196

Root layout now mounts only Clerk and styles. Administrative pages move into the
URL-preserving `(admin)` route group. Authentication forms and APIs stay outside
that shell. The admin layout verifies /v1/admin/me before importing Sidebar or
rendering panel children. Session presence alone never admits the panel.

A valid actor with backoffice.access renders the panel. No session offers sign-in
(the existing Proxy normally redirects first). Backend 403 or a valid permission
array missing backoffice.access renders a plain refusal with sign-out. Malformed
or unavailable authorization renders an unavailable message with sign-out.

Existing page guards and API/backend authorization remain. Layouts can be reused
on soft navigation, so this is a presentation boundary, not the security boundary.
Request-render React cache avoids duplicate /me reads between layout and page;
there is no persistent or cross-user cache. No live permissions/Clerk changes.

Tests render the real admin layout for admin, denied, signed-out and unavailable
states; a private child fails if evaluated without permission, and Sidebar must
not even be imported on refusal. Server verifier tests distinguish missing
permission, malformed payload and no session. Preview browser sign-in/revocation
and deployed bundle inspection remain for review.
