# Deploying CooperativeOS to cPanel

Single-domain layout: one cPanel domain serves everything. Django answers
`/api` and `/admin`, WhiteNoise serves `/static` plus the Vite build's
root-level assets, and any other path returns the React SPA shell.

This layout is not optional. The web client's axios `baseURL` is a relative
`/api/v1` (`frontend/src/api/client.ts`) with no environment override, so the
app and the API **must** share an origin. Splitting them onto `app.` and `api.`
subdomains requires a frontend code change plus `CORS_ALLOWED_ORIGINS`.

> **A note on host choice.** `CooperativeOS_PRD_and_Implementation_Plan.md`
> (§ line 149) recommends Docker on a VPS over cPanel for this build. cPanel is
> workable here because the project has **no Celery, Redis or background
> workers** — everything runs in-request. If that changes, revisit the host.

---

## 1. Host requirements — confirm before you start

| Requirement | Why |
|---|---|
| Python **3.11–3.13** | Django 5.2 needs ≥ 3.10. Set in cPanel → Setup Python App. |
| **MySQL ≥ 8.0.16** or **MariaDB ≥ 10.5** | Django 5.2's floor is MySQL 8.0.11 / MariaDB 10.5. But below **MySQL 8.0.16** Django *silently omits* CHECK constraints — the ledger's "debit XOR credit" and "amounts non-negative" rules would stop being enforced by the database. MariaDB supports them at every accepted version. |
| SSH access | Strongly preferred. `migrate` and `collectstatic` are far easier than via File Manager. |
| A TLS certificate | `SECURE_SSL_REDIRECT` and secure cookies are on by default. |

Verify the database version first:

```sql
SELECT VERSION();
```

If it reports MySQL older than 8.0.16, stop and use MariaDB or a different host.

> **Verified before writing this.** Every migration was applied to a scratch
> MariaDB 12.3.2 database (51 tables, 28 unique indexes, no index-length
> problems), and the full test suite — 195 tests — passed against MariaDB, not
> just the SQLite used in development. Both ledger CHECK constraints were
> confirmed present in `information_schema`:
>
> ```
> ledger_amounts_non_negative   `debit` >= 0 and `credit` >= 0
> ledger_debit_xor_credit       `debit` > 0 and `credit` = 0
>                                 or `debit` = 0 and `credit` > 0
> ```
>
> That is what the MySQL 8.0.16 floor protects — on an older MySQL these are
> silently dropped and the database stops enforcing double-entry.

---

## 2. Create the database

cPanel → **MySQL Databases**. Create a database and a user, then grant
**ALL PRIVILEGES**. cPanel prefixes both with your account name:

- database: `cpuser_coopdb`
- user: `cpuser_coopapp`

cPanel creates the database **latin1**, and every table inherits that, even
though the app connects with `utf8mb4`. Names with Yorùbá, Igbo or Hausa tone
marks ("Ìmọ̀lè", "Adéọlá") are then refused with `Incorrect string value`. Step 6
converts it with `fix_db_charset`.

---

## 3. Create the Python application

cPanel → **Software → Setup Python App → Create Application**.

| Field | Value |
|---|---|
| Python version | 3.11–3.13 |
| Application root | the uploaded `backend/` directory |
| Application URL | your domain, at `/` |
| Application startup file | `passenger_wsgi.py` |
| Application Entry point | `application` |

`passenger_wsgi.py` is already in the repo; it puts `backend/` on `sys.path` and
defaults `DJANGO_SETTINGS_MODULE` to `config.settings.prod`.

---

## 4. Upload the code

Upload the repo so the server has:

```
<app root>/            <- backend/ contents, incl. passenger_wsgi.py
../frontend/dist/      <- the built SPA, a sibling of the app root
```

`config.settings.base.FRONTEND_DIST` resolves to `BASE_DIR.parent/frontend/dist`,
so keep `backend/` and `frontend/` siblings exactly as in the repo.

Build the SPA **locally** and upload the output — cPanel has no Node:

```bash
cd frontend && npm ci && npm run build
```

Do not upload `.venv/`, `db.sqlite3`, `__pycache__/`, or `backend/staticfiles/`.

---

## 5. Configure the environment

Copy `backend/.env.example` to `backend/.env` and fill it in. Generate the key:

```bash
python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
```

Required: `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `MYSQL_DB`, `MYSQL_USER`,
`MYSQL_PASSWORD`. The app refuses to boot without them — deliberately.

**Also set `SITE_URL`**, and unlike the above the app will *not* complain if you
forget it:

```
SITE_URL=https://mycooperativeos.com
```

Links inside emails are absolute, because an email client has no notion of the
request that produced them. Without `SITE_URL` every password-reset and welcome
link points at `http://localhost:5173` — the mail sends, looks correct, and is
useless to the recipient.

`CSRF_TRUSTED_ORIGINS` defaults to `https://` + each allowed host. If the admin
login returns 403 behind the host's TLS proxy, set it explicitly.

---

## 6. Install, migrate, collect

In cPanel's virtualenv (the Setup Python App page prints the `source .../activate`
command):

```bash
# manage.py defaults to config.settings.dev, which has no STATIC_ROOT and no
# MySQL config. Every server-side command must select prod explicitly, or
# collectstatic fails with ImproperlyConfigured and migrate targets SQLite.
export DJANGO_SETTINGS_MODULE=config.settings.prod

pip install -r requirements.txt          # NOT requirements-dev.txt
python manage.py migrate
python manage.py fix_db_charset --apply  # latin1 → utf8mb4; skips converted tables
python manage.py collectstatic --noinput
python manage.py createsuperuser
mkdir -p media && chmod 755 media        # uploads target; must be writable
```

**Never run `seed_demo` or `seed_platform` here.** They create fictional
cooperatives, members, invoices and users, and both refuse to run under
`config.settings.prod`. Plans and prices come from `migrate`.

The running app is unaffected by this: `passenger_wsgi.py` and `wsgi.py` both
default to `config.settings.prod` on their own. It only bites CLI commands.

`requirements.txt` uses **PyMySQL**, which is pure Python — no compiler or
`libmysqlclient` headers needed. Swap in `mysqlclient` if the host provides it.

Then **Restart** the app from the Setup Python App page. Passenger caches code;
restart after every deploy.

---

## 7. Verify

```bash
DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py check --deploy
# must report zero issues
```

Then in a browser:

- `https://yourdomain/` → the SPA loads, styled, with fonts
- `https://yourdomain/admin/` → the green CooperativeOS admin login
- `https://yourdomain/api/v1/` → DRF responds (401/403 unauthenticated is correct)
- Hard-refresh a deep link such as `/app/savings` → still loads (catch-all works)

**Enable 2FA on your superuser immediately.** Financial models (contributions,
loans, dividends, ledger accounts, memberships, payment events) are read-only in
the admin until `two_factor_enabled` is set — that gate is deliberate. Set it at
Admin → Users → your account → Permissions.

Finally, point the Paystack webhook at:

```
https://yourdomain/api/v1/webhooks/paystack/
```

---

## Before real member data

One item is **not** resolved by this deployment and needs a decision:

1. **No version control.** The project is not a git repository, so a deploy is a
   file upload with no rollback. Initialise one before the first production
   deploy, and take a database dump before every `migrate`:
   ```bash
   mysqldump -u cpuser_coopapp -p cpuser_coopdb > backup-$(date +%F).sql
   ```

### Uploaded media — how it is protected (resolved)

`/media/...` used to be served with no authentication at all, so anyone with —
or guessing — a URL could fetch a member photograph or a KYC document. Those are
NDPA-regulated. That is now closed, and it is worth knowing how, because the
design is not obvious.

**Not all media is private.** Cooperative logos and favicons, platform branding,
site-content photographs and the uploaded APK are *meant* to be public — the
marketing site serves them to anonymous visitors. Only two prefixes are gated,
listed in `PRIVATE_MEDIA_PREFIXES`:

```
member_photos/        a member's headshot
member_documents/     means of ID, proof of address, membership form
```

**Private files are released three ways, and no others:**

| Route | Who | How |
|---|---|---|
| `/media/private/<token>/<file>` | Any client holding a valid token | A signed, expiring capability minted by `core.media` when an authorised API call serialises the record |
| `/media/<path>` | Staff with an **admin session** | Django admin renders plain `/media/` links, and reviewing KYC there is a real workflow. Session auth is a genuine identity check |
| `/media/<path>` | Everyone else | **404** — not 403, since a document's existence is itself information |

**Why signed URLs rather than an authenticated view.** The SPA and the Flutter
app authenticate with a DRF **token** header. A browser sends no such header for
`<img src>` or a link opened in a new tab, so a `login_required` gate would break
every photograph and document link. Authorisation therefore stays at the API —
which already enforces tenant scoping and role — and the serializer hands back a
short-lived capability for one file.

**The trade this accepts, plainly:** for the life of the signature the URL *is*
the authorisation, so anyone it is forwarded to can fetch that one file until it
expires. Same model as an S3 pre-signed URL. Tune the window with
`PRIVATE_MEDIA_TTL` (seconds, default `3600`).

Two operational notes:

- The gate is enforced with `DEBUG` **on and off**. It used to fall back to
  Django's `static()` helper in development, which serves everything openly —
  meaning a developer would never have seen a private URL fail.
- Nothing on the client changed. The console, member app and Flutter client all
  read whatever URL the API returns, and that URL stays **absolute**, as DRF's
  `FileField` had it. A relative URL would still work in a browser while
  silently breaking `NetworkImage` on Android.

Covered by `backend/tests/test_private_media.py`.

## Troubleshooting: `/admin/` and `/api/v1/` return 404

First establish **who answered the 404** — LiteSpeed/Apache, or Django. They are
trivially distinguishable by headers:

```bash
curl -sI https://YOURDOMAIN/admin/ | head -20
```

Django's `/admin/` reply is a **302** to the login page carrying
`X-Frame-Options: DENY`, `Referrer-Policy: same-origin`,
`Cross-Origin-Opener-Policy: same-origin` and `Vary: Cookie, origin`.

If instead you get `404` with `server: LiteSpeed` and `vary: User-Agent` and
none of those headers, the web server answered from disk and **Python was never
invoked**. `/admin/` cannot 404 from Django — it is the first route registered.
Nor can the usual failure modes produce one: a bad `ALLOWED_HOSTS` gives **400**,
a boot failure gives Passenger's **500** page, and a missing SPA build only
affects `/`.

When requests never reach Django, check in this order:

1. **The Passenger block is missing from the document root's `.htaccess`.**
   cPanel writes a `# CLOUDLINUX PASSENGER CONFIGURATION BEGIN` block there when
   the app is created. Copying `frontend/dist/` over `public_html/` deletes it.
   The tell is that `/` still works (a real `index.html` on disk) while every
   other path 404s.
2. **Application root isn't the directory holding `passenger_wsgi.py`** — it must
   be `backend/`, not the repo root and not `public_html`.
3. **Application URL isn't `/`.** This is the most common cause, and the
   `.htaccess` search above names it precisely: the Passenger block appears at
   `public_html/<folder>/.htaccess` rather than `public_html/.htaccess`. cPanel
   mounted the app at `/<folder>`, so LiteSpeed only routes `/<folder>/...` to
   Python and serves everything else from disk. Passenger strips the base URI,
   so Django is alive one level in — `https://YOURDOMAIN/<folder>/admin/` will
   return a 302 while `/admin/` 404s. Fix it by setting Application URL to the
   domain root and restarting; changing the *URL* does not rebuild the
   virtualenv (changing the Application **root** does).

   After remounting, delete any placeholder `public_html/index.html` and the old
   `public_html/<folder>/` mount directory — real files on disk are served by
   LiteSpeed before Passenger sees the request, so they will shadow the app.
4. **The app wasn't restarted.** Passenger caches code; use Restart on the Setup
   Python App page after every upload.

Note that **`/api` returning 404 is correct** — it was never a route. The API is
mounted at `/api/v1/`.

Do not hand-copy the SPA into the document root. With the app mounted at `/`,
Passenger owns every URL and WhiteNoise serves the build from
`frontend/dist` (`WHITENOISE_ROOT`). Files dropped into the document root
shadow the app and are exactly what causes this failure.

## Troubleshooting: unstyled admin, or `/` returns 404

These two look like one fault but are independent, and often appear together
right after a deploy.

**Admin and the DRF browsable API render but have no styling.**
`/static/` is empty. `staticfiles/` is build output and is gitignored, so it is
**not** shipped by `git pull` — it must be regenerated on the server:

```bash
cd ~/coop
DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py collectstatic --noinput
```

Losing styling in the admin *and* the API at the same time is the signature of
the whole `/static/` tree being absent, rather than one bad file.

**`/` returns 404 while `/admin/` works.** `FRONTEND_DIST` is not resolving to a
directory containing `index.html`. Note the failure is quiet: WhiteNoise logs
only `UserWarning: No directory at: <path>` and the app boots normally, so check
the Passenger log rather than expecting a 500. Verify the build is present and
the path is set:

```bash
ls ~/coop/frontend_dist/index.html
grep FRONTEND_DIST ~/coop/.env
```

**Restart the app after either fix.** WhiteNoise builds its file index once at
startup, so files added after boot stay invisible — `collectstatic` alone will
not un-break styling until Passenger restarts.

## Where the errors are logged

Django logs almost nothing by default once `DEBUG=False` — errors go to
`mail_admins`, `ADMINS` is empty, and the record is lost. DRF is worse: it turns
exceptions into responses before `django.request` runs, so **API 4xx failures
leave no trace at all**. That is why a rejected upload could only be seen as a
generic message in the browser.

Both gaps are now closed. Everything lands in a rotating file next to the app
(5 MB × 5) and on stderr, which Passenger captures:

```bash
tail -f ~/coop/logs/app.log          # live
grep -n " 4[0-9][0-9] \| 5[0-9][0-9] " ~/coop/logs/app.log | tail -30
```

A rejected upload now reads, in one line:

```
2026-09-22 10:31:02,114 WARNING api.errors PATCH /api/v1/cooperatives/3/ -> 400
(user=you@example.com, view=CooperativeViewSet): {'logo': [ErrorDetail(
string='Upload a valid image. The file you uploaded was either not an image
or a corrupted image.', code='invalid_image')]}
```

Successful requests are deliberately not logged, so the file stays signal.
`~/coop/logs/` is gitignored; override the location with `DJANGO_LOG_DIR`.

If a failure produces **no entry at all**, the request never reached Django —
the web server rejected it first. The usual cause is an upload larger than
LiteSpeed's limit, which closes the connection without a status (the browser
reports a network error rather than an HTTP code).

## Scheduled reminders (cron)

There is no worker process on shared hosting, so arrears and meeting reminders
are driven by a cron entry rather than a queue.

cPanel → **Cron Jobs** → add a daily job (early morning local time works well —
members read mail before the day starts):

```
0 6 * * *  cd ~/coop && DJANGO_SETTINGS_MODULE=config.settings.prod /home/mycooper/virtualenv/coop/3.11/bin/python manage.py send_reminders >> ~/coop/logs/reminders.log 2>&1
```

Use the interpreter path from the Setup Python App page — the system `python`
is not the app's virtualenv and will not have Django installed.

Check what it would do before scheduling it:

```bash
cd ~/coop && DJANGO_SETTINGS_MODULE=config.settings.prod \
    python manage.py send_reminders --dry-run
```

It prints a per-society breakdown and contacts nobody. Useful flags:
`--cooperative ID` (one society), `--skip-arrears`, `--skip-meetings`,
`--meeting-days N` (default 2).

The command only ever notifies — it charges nothing and posts nothing to the
ledger — so a duplicate run is harmless. Only **ACTIVE** societies are
contacted, so prospective and suspended ones are left alone.

## Subscription billing (cron)

A second daily job runs the subscription cycle: it raises an invoice when a
cooperative's month ends, marks anything past its due date overdue, reminds
every few days while an invoice is outstanding, and suspends a cooperative once
an invoice is long overdue.

```
30 6 * * *  cd ~/coop && DJANGO_SETTINGS_MODULE=config.settings.prod /home/mycooper/virtualenv/coop/3.11/bin/python manage.py run_billing >> ~/coop/logs/billing.log 2>&1
```

> **Read this one differently from `send_reminders`.** That command only
> notifies, which is why a duplicate run is described above as harmless.
> `run_billing` **sends mail and can suspend a live tenant** — suspending locks
> real members out of their own savings records. Run the dry run first, and
> read the output:

```bash
cd ~/coop && DJANGO_SETTINGS_MODULE=config.settings.prod \
    python manage.py run_billing --dry-run
```

It prints what would be invoiced, marked overdue, reminded and suspended, and
changes nothing. `--cooperative SLUG` limits it to one tenant.

Re-running on the same day is still safe: no invoice is raised while one is
already outstanding, and reminders honour their own interval.

The policy numbers are settings, not literals, because they are commercial
decisions rather than mechanics — override them in the environment:

| Setting | Default | Meaning |
| --- | --- | --- |
| `BILLING_TRIAL_DAYS` | 30 | Free period granted at go-live |
| `BILLING_DUE_DAYS` | 7 | Days to settle before an invoice is overdue |
| `BILLING_REMINDER_INTERVAL_DAYS` | 3 | Gap between reminders |
| `BILLING_SUSPEND_AFTER_DAYS` | 30 | Days past due before suspension |

A cooperative whose tier has no active `Plan` gets **no** subscription and is
never invoiced — going live deliberately does not fail over a missing price
list. Create the plans before taking tenants live, or they will operate free
indefinitely and silently.

## Redeploying

```bash
# locally
cd frontend && npm run build
# upload backend/ changes and frontend/dist/, then on the server:
export DJANGO_SETTINGS_MODULE=config.settings.prod
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
# then Restart from the Setup Python App page
```

`collectstatic` is mandatory on every deploy now that `staticfiles/` is
gitignored — `git pull` no longer carries it.

### Troubleshooting: "I deployed, but the site still runs the old version"

Three independent causes, in the order worth checking:

1. **The app wasn't restarted.** WhiteNoise builds its file index once at
   startup, so a freshly uploaded `frontend/dist/` stays invisible until you
   Restart from the Setup Python App page. New bundles have new hashed names,
   so the server answers with the old ones it still knows about.
2. **A stale service worker.** This is a PWA: the worker precaches the app
   shell and answers navigations from its own cache. Until it updates, it keeps
   serving the previous bundle — the browser never reaches your new files at
   all. To confirm, open DevTools → Application → Service Workers and tick
   *Update on reload*, or hard-reload with Shift+Reload. To clear it outright,
   *Unregister* then reload.
3. **`frontend/dist/` was never rebuilt or uploaded.** `npm run build` is a
   local step — cPanel has no Node.

To tell which build is actually being served, view source on `/` and look at
the hashed filename in the `<script src="/assets/index-….js">` tag. Compare it
with your local `frontend/dist/assets/`. If they differ, the server is serving
an older build (cause 1 or 3). If they match but the browser still behaves like
the old version, it is the service worker (cause 2).

> Cause 2 used to be effectively permanent. `sw.js` is served from the build
> root with no content hash, and WhiteNoise only treats files under
> `/static/` as immutable — so the worker was going out with
> `Cache-Control: max-age=3600` and could not update promptly, while the
> hashed bundles that *could* have been cached forever were also capped at an
> hour. `WHITENOISE_ADD_HEADERS_FUNCTION` now fixes both ends. A browser that
> already holds the old worker may still need one hard reload to pick it up;
> after that, deploys take effect on their own.

---

## Email (Brevo SMTP)

Set these in `backend/.env`:

```bash
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=587
EMAIL_USE_TLS=true
EMAIL_HOST_USER=            # the Brevo SMTP login, not always your sign-in email
EMAIL_HOST_PASSWORD=        # the generated SMTP key, not your dashboard password
SITE_URL=https://mycooperativeos.com

# DEFAULT_FROM_EMAIL defaults to "CooperativeOS <info@mycooperativeos.com>" in
# code, so set it only to send as something else. Whatever it is must be
# verified with Brevo, or mail is accepted and then dropped.
```

`SITE_URL` matters as much as the credentials: reset and welcome links are
absolute, because an email client has no notion of the request. Left unset they
point at `localhost` and are useless.

### Test it without waiting for a real reset

```bash
cd ~/coop
DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py send_test_email you@example.com
```

It prints the resolved configuration (never the password), sends one message,
and translates whatever the relay says into a likely cause. `manage.py check`
also warns now if SMTP is selected but incomplete.

### Why mail fails silently

The password-reset endpoint always answers *"if that address has an account, a
reset link is on its way"* — it has to, or it becomes a way to test which
addresses are registered. So a wrong password looks exactly like working mail
from the browser. **The real error is in the log**, not on screen:

```bash
tail -50 ~/coop/logs/app.log
```

Delivery failures are recorded there by `api.errors`. In order of likelihood:

1. **`DEFAULT_FROM_EMAIL` is not a verified sender.** Brevo refuses to send on
   behalf of an address it has not verified and rejects at SMTP time. Verify the
   sender — and ideally the whole domain, with SPF and DKIM — in Brevo under
   *Senders, Domains & Dedicated IPs*. This is the most common cause by a wide
   margin.
2. **Wrong SMTP credentials.** `EMAIL_HOST_USER` is the SMTP login shown in
   Brevo, which is often not your account email, and the password is a generated
   SMTP key rather than the one you log in with.
3. **The host blocks outbound SMTP.** Some shared hosts do. Port 587 is the one
   to use; if it is blocked entirely, switch to Brevo's HTTP API.
4. **Accepted but not delivered.** If the command reports success and nothing
   arrives, it is filtering, not configuration — check spam, then Brevo's
   activity log. Mail from a domain without SPF and DKIM is often dropped
   without a bounce.

### The go-live announcement

When an onboarding item reaches **Go-live**, the cooperative is switched to
ACTIVE and told so by email. It goes to the cooperative's `contact_email` plus
every active officer holding a privileged permission — secretary and treasurer
by default; chairperson and plain members do not qualify, because privilege is
decided by permissions rather than job title.

It is sent once. Advancing Go-live → Done does not repeat it.

**To send it again** — the case where it went out but never arrived:

- **Django admin → Onboarding items**, tick the row, choose *"Resend the
  go-live email"*. The list shows a **`golive email sent at`** column, so an
  empty cell means it was never sent, which is a different fault from a message
  that was sent and lost.
- Or from the server:

  ```bash
  cd ~/coop && DJANGO_SETTINGS_MODULE=config.settings.prod \
      python manage.py send_golive_email <slug> --force
  ```

  `--dry-run` shows who would be told without sending. Without `--force` it
  will not re-send to a cooperative that has already been told, so it is safe
  to run down a list.

If it reports that there is nobody to tell, the cooperative has no
`contact_email` and no active privileged officer — it went live with no one
informed. Set a contact address on the cooperative, or admit an officer, then
run it again.

---

## White-label custom domains

A cooperative on a paid tier can serve the app from its own domain. The console
shows them the exact record to add: a **CNAME** from their domain to
`WHITE_LABEL_CNAME_TARGET`, which defaults to `tenants.mycooperativeos.com`.

**That target needs a DNS record of its own.** Changing the setting does not
create one. In cPanel → Zone Editor, add an `A` record for
`tenants.mycooperativeos.com` pointing at this server's IP. Until that exists,
every customer CNAME resolves nowhere and the Verify button will never succeed.

You also need the host to answer for those names — a wildcard or per-domain
entry in `DJANGO_ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS`, plus a certificate
covering them (cPanel's AutoSSL will issue per domain once DNS resolves).

> **This target changed.** It previously defaulted to
> `tenants.cooperativeos.africa`, a domain the platform does not own, so any
> cooperative that has already added a CNAME is pointing at nothing. They must
> re-point it at `tenants.mycooperativeos.com`. Nothing in the database stores
> the old value — `Domain` records only hold the customer's own domain — so no
> migration is involved; it is purely DNS on their side.
>
> To see whether anyone is affected:
>
> ```bash
> cd ~/coop && DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py shell -c "
> from platform_admin.models import Domain
> for d in Domain.objects.select_related('cooperative'):
>     print(d.domain, '|', d.cooperative.name, '|', d.dns_status)
> "
> ```
>
> Rows that came from `seed_platform` (`unitysavings.ng`, `my.imole.coop`) are
> demo data and can be ignored.

---

## Editing the public site (no deploy required)

The landing page's wording and imagery live in the database, not in the React
bundle. `migrate` seeds them with the current copy on first run, so the screens
are already filled in — an editor changes what is there rather than starting
from blank boxes.

In **Django admin → Platform admin**:

| Screen | What it controls |
|---|---|
| **Site content** | Headline, intro paragraph, button labels, hero photo, the green band, every section heading, the mobile-app section, the closing banner, pricing intro, footer and the search-engine description. One row — it cannot be added or deleted. |
| **Site feature cards** | The "Everything a society runs on" grid. Icon, title, body. |
| **Site feature deep-dives** | The alternating photo-and-text blocks. Each has a few sentences plus bullet points (**one per line**) and its own photograph. |
| **Site how-it-works steps** | The numbered steps, and the icon each one shows in the diagram above them. |
| **Site trust badges** | The line of assurances above the footer. |
| **Site gallery photos** | The photo strip. Ships with three built-in photographs; add a row here and your photos replace the whole set. |

### The mobile apps section

It stays hidden until there is something to show, then appears on its own. On
the **Site content** screen:

- **Google Play link** / **App Store link** — each button appears only when its
  link is filled in, so an unreleased iOS app advertises nothing.
- **Upload the APK** — for side-loading before you publish to Play. If a Play
  Store link is also set, that wins: publishing must not strand members on a
  raw file.
- **Small note** — ships saying the apps are on the way. Clear it once the
  links are live.

> APKs are large. cPanel and LiteSpeed cap upload size, so the admin form can
> time out on a big file. If it does, upload the APK over SFTP into `media/`
> and paste its URL into the Google Play link field instead — the button does
> not care which of the two it gets.

Two things worth knowing:

- **Ordering and hiding.** Every list has `order` (low numbers first) and
  `visible`. Untick `visible` to take something off the site while keeping the
  text — better than deleting it to try a shorter page.
- **Prices are never typed here.** The pricing cards read live from the
  **Plans** table, so published pricing cannot drift from what societies are
  actually billed. The text on the Site content screen is only the heading and
  the fallback shown when no plans are published yet.

> **If the live site shows the fallback wording instead of pricing cards**, it
> means there are no `active` Plan rows yet — the section has nothing to render.
> Create them in **Django admin → Plans**. Do *not* run `seed_platform` on a
> production database to fix this: that command exists to populate a demo
> environment and also creates fictitious cooperatives, invoices and support
> tickets.
>
> The same applies to member self-join: **Django admin → Cooperatives** must
> contain at least one society with status `active` before the "Join a society"
> search on /signup can return anything. Societies created through the public
> application form are deliberately `prospective` until a human takes them
> live.

Changes appear within about a minute (the page caches content briefly).

### Photographs

The site ships with eight photographs built into the frontend — hero, three
feature deep-dives, three in the photo strip, and the closing banner. They are
defaults, not fixtures: upload an image on the matching screen and it replaces
the bundled one immediately, with no deploy. Leave a field empty and the
default comes back.

The one exception is the photo strip, which is all-or-nothing: adding any row
to **Site gallery photos** replaces the entire built-in set, so the strip is
either wholly yours or wholly ours rather than a mix that would look
accidental. Hiding every row leaves the strip empty rather than restoring the
defaults.

Where they came from, and the caveat: `frontend/src/assets/site/CREDITS.md`.
All eight are Pexels-licensed — free commercially, no attribution required —
but that licence covers the *photograph*, not the **people in it**. There are
no model releases. Generic illustration is ordinary and low-risk; a caption
implying someone pictured is a member, customer or endorser is not. Replacing
them with real cooperatives who have agreed to appear is the durable fix, and
will look far more like your product than stock does.

To source replacements, **Pexels**, **Unsplash** and **Nappy** (the last with
better representation of African and Black subjects) all offer free commercial
use — read each licence before publishing.

Practical notes: landscape, at least 1200px wide for the hero and 800px for the
gallery; `alt` text is required on gallery photos and should describe what is
happening, not repeat the caption. Uploads land in `media/`, which must stay
writable (see §6) and is **not** covered by `collectstatic` — it is served
directly, so it survives a redeploy but is not restored by `git pull`. Back it
up with the database.
