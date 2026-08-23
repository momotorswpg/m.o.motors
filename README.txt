M.O MOTORS ADMIN PAGE

Files
- admin.html: private inventory dashboard
- admin.js: Supabase login, vehicle creation, bulk photo upload, gallery management
- admin.css: admin styling
- supabase-admin-setup.sql: run once in Supabase SQL Editor

SETUP
1. In Supabase > SQL Editor, run supabase-admin-setup.sql.
2. In Supabase > Authentication > Users, create the admin user (email + password).
3. Upload admin.html, admin.js and admin.css to the same hosting location as the public website.
4. Open /admin.html in a browser.
5. Sign in with the Supabase admin user.
6. Add a vehicle, select it in the inventory list, and choose multiple photos at once.

IMPORTANT
- Do not put a service_role key in the browser.
- This admin uses the publishable key supplied for the M.O Motors project.
- The SQL policies allow any authenticated Supabase user to manage inventory. Keep public signup disabled or only create trusted admin accounts.
