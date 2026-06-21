# PBPartners — White-Label SaaS Mobile Platform
## Technical Requirement Document (TRD/PRD) + System Architecture

**Version:** 1.0 | **Date:** June 2026 | **Author:** Senior Full-Stack Architect

---

## 1. EXECUTIVE SUMMARY

PBPartners is a White-Label SaaS mobile platform for Insurance Agents and Business Professionals. It provides a Creative Marketing Hub (poster maker, animated video, AI captions), a Business Core (digital policies, CRM, payments), and a Subscription Monetization layer — all under a multi-tenant architecture that lets you sell the platform to Insurance, Real Estate, Finance, and other verticals.

---

## 2. TECH STACK RECOMMENDATION

### Frontend — React Native (Expo SDK 54+) ✅ CHOSEN
| Layer | Technology | Reason |
|---|---|---|
| Mobile | **Expo (React Native)** | Single codebase for iOS + Android + Web. Expo Go for fast dev. OTA updates via EAS. |
| State | **React Query (TanStack)** | Server state, caching, background sync |
| Navigation | **Expo Router (file-based)** | Deep linking, tabs, modals out of box |
| UI | **NativeWind / Tailwind** | Rapid styling, theme tokens |
| Auth | **OTP via SMS (Twilio/MSG91)** + **Google OAuth** | Mobile-first auth |
| Storage | **AsyncStorage + SecureStore** | Local state + secure tokens |
| Animations | **React Native Reanimated v4** | 60fps gesture + drag animations |
| Canvas | **react-native-skia** | High-performance poster editor canvas |
| Video | **expo-av + FFmpeg WebAssembly** | Animated video preview + export |

### Backend — Node.js (Express 5) ✅ CHOSEN
| Layer | Technology | Reason |
|---|---|---|
| API | **Express 5 + TypeScript** | Already in monorepo, well-typed |
| DB | **PostgreSQL + Drizzle ORM** | Already in monorepo, relational for multi-tenancy |
| Auth | **JWT + OTP (MSG91)** | Stateless, scalable |
| File Storage | **AWS S3 / Cloudflare R2** | Poster images, video assets, policy PDFs |
| AI | **OpenAI GPT-4o + DALL-E 3** | Captions, image generation |
| Payments | **Razorpay (India) + Stripe (Global)** | Subscription + one-time |
| Queue | **BullMQ + Redis** | Video rendering, email jobs |
| Email | **Resend.com** | Transactional emails |
| CDN | **Cloudflare** | Static assets, poster delivery |
| Infra | **Railway / Render / AWS ECS** | Container deployment |

### Why NOT Flutter?
Expo React Native shares code with your existing web admin panel (React). Flutter would require rebuilding all UI in Dart. Stick with Expo.

### Why NOT MongoDB?
You have relational data (Tenants → Users → Policies → Templates). PostgreSQL + Drizzle is already set up and is the right choice for multi-tenancy row-level security.

---

## 3. MULTI-TENANT ARCHITECTURE

### 3.1 Tenancy Model: Schema-per-Tenant (Row-Level)
Each tenant (partner/reseller) shares the same PostgreSQL database but all rows are scoped by `tenant_id`. This avoids database-per-tenant cost explosion while keeping data isolated.

```
┌─────────────────────────────────────────────────────────┐
│                    SHARED DATABASE                      │
│  tenants table → tenant_id FK on every other table      │
│  Row-Level Security (RLS) policies in PostgreSQL         │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Domain Routing
- Main platform: `app.pbpartners.com`
- White-label partner: `insurance.hdfc.com` → resolves via CNAME to `app.pbpartners.com` → middleware reads `Host` header → loads tenant config

### 3.3 Tenant Config (loaded at boot)
```json
{
  "tenantId": "hdfc-insurance",
  "brandName": "HDFC Insurance",
  "logoUrl": "https://cdn.pbpartners.com/tenants/hdfc/logo.png",
  "primaryColor": "#E60028",
  "secondaryColor": "#002A8F",
  "domain": "app.hdfc-insurance.com",
  "features": ["poster_maker", "crm", "policy_viewer"],
  "subscriptionPlan": "enterprise"
}
```

---

## 4. DATABASE SCHEMA

### 4.1 Tenants
```sql
CREATE TABLE tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          VARCHAR(60) UNIQUE NOT NULL,         -- "hdfc-insurance"
  brand_name    VARCHAR(120) NOT NULL,
  logo_url      TEXT,
  primary_color VARCHAR(9) DEFAULT '#1D4ED8',
  secondary_color VARCHAR(9) DEFAULT '#7C3AED',
  domain        VARCHAR(255) UNIQUE,                 -- custom domain
  plan          VARCHAR(20) DEFAULT 'starter',       -- starter|pro|enterprise
  is_active     BOOLEAN DEFAULT true,
  settings      JSONB DEFAULT '{}',                  -- feature flags, watermark, etc.
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

### 4.2 Users
```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  phone         VARCHAR(15) UNIQUE NOT NULL,
  name          VARCHAR(120),
  email         VARCHAR(255),
  avatar_url    TEXT,
  role          VARCHAR(20) DEFAULT 'agent',        -- agent|admin|superadmin
  language      VARCHAR(10) DEFAULT 'en',           -- en|mr|hi|ja
  is_premium    BOOLEAN DEFAULT false,
  trial_ends_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  INDEX (tenant_id),
  INDEX (phone)
);
```

### 4.3 Subscriptions
```sql
CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  tenant_id       UUID REFERENCES tenants(id),
  plan            VARCHAR(20) NOT NULL,             -- monthly|yearly|trial
  amount_paise    INTEGER,                          -- in paise (₹499 = 49900)
  currency        VARCHAR(3) DEFAULT 'INR',
  status          VARCHAR(20) DEFAULT 'active',     -- active|cancelled|expired
  razorpay_sub_id VARCHAR(100),
  stripe_sub_id   VARCHAR(100),
  starts_at       TIMESTAMPTZ DEFAULT now(),
  ends_at         TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### 4.4 Templates
```sql
CREATE TABLE templates (
  id            SERIAL PRIMARY KEY,
  tenant_id     UUID REFERENCES tenants(id),        -- NULL = global template
  category_id   INTEGER REFERENCES categories(id),
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  image_url     TEXT NOT NULL,                      -- S3/R2 URL
  thumbnail_url TEXT,
  type          VARCHAR(20) DEFAULT 'poster',       -- poster|video|story
  tags          TEXT[] DEFAULT '{}',
  languages     TEXT[] DEFAULT '{en}',              -- en|mr|hi
  is_premium    BOOLEAN DEFAULT false,
  is_animated   BOOLEAN DEFAULT false,
  layers        JSONB DEFAULT '[]',                 -- editor layer data
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

### 4.5 Policies (Insurance Business Core)
```sql
CREATE TABLE policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id),
  customer_id     UUID REFERENCES customers(id),
  agent_id        UUID REFERENCES users(id),
  policy_number   VARCHAR(60) UNIQUE NOT NULL,
  insurer         VARCHAR(120),                     -- "SBI Life", "LIC", "HDFC"
  policy_type     VARCHAR(60),                      -- "Car", "Health", "Term"
  premium_amount  NUMERIC(12,2),
  sum_assured     NUMERIC(14,2),
  start_date      DATE,
  end_date        DATE,
  status          VARCHAR(20) DEFAULT 'active',
  document_url    TEXT,                             -- PDF on S3
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### 4.6 Customers (CRM)
```sql
CREATE TABLE customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id),
  agent_id    UUID REFERENCES users(id),
  name        VARCHAR(120) NOT NULL,
  phone       VARCHAR(15),
  email       VARCHAR(255),
  dob         DATE,                                 -- for birthday wishes
  anniversary DATE,                                -- for anniversary wishes
  address     TEXT,
  tags        TEXT[] DEFAULT '{}',
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  INDEX (tenant_id, agent_id),
  INDEX (dob),
  INDEX (anniversary)
);
```

### 4.7 Claims
```sql
CREATE TABLE claims (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id),
  policy_id     UUID REFERENCES policies(id),
  customer_id   UUID REFERENCES customers(id),
  claim_number  VARCHAR(60) UNIQUE,
  claim_type    VARCHAR(60),
  amount        NUMERIC(12,2),
  status        VARCHAR(20) DEFAULT 'submitted',   -- submitted|processing|approved|rejected
  description   TEXT,
  photos        TEXT[] DEFAULT '{}',               -- S3 photo URLs
  submitted_at  TIMESTAMPTZ DEFAULT now(),
  resolved_at   TIMESTAMPTZ
);
```

### 4.8 Poster Exports
```sql
CREATE TABLE poster_exports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  tenant_id   UUID REFERENCES tenants(id),
  template_id INTEGER REFERENCES templates(id),
  export_url  TEXT NOT NULL,
  format      VARCHAR(10) DEFAULT 'png',           -- png|jpg|mp4
  has_watermark BOOLEAN DEFAULT false,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

---

## 5. API ENDPOINTS — "EDIT POSTER" FEATURE

### Base URL: `POST /api/posters`

#### 5.1 Get Template for Editing
```
GET /api/templates/:id/editor
Authorization: Bearer <token>

Response 200:
{
  "id": 42,
  "title": "SBI Car Insurance - Diwali",
  "imageUrl": "https://cdn.pbpartners.com/templates/42/base.png",
  "layers": [
    {
      "id": "text-agent-name",
      "type": "text",
      "x": 120, "y": 340,
      "text": "Your Agent Name",
      "fontSize": 24,
      "fontFamily": "Poppins",
      "color": "#FFFFFF",
      "editable": true
    },
    {
      "id": "img-logo",
      "type": "image",
      "x": 20, "y": 20,
      "width": 80, "height": 80,
      "src": "https://cdn.pbpartners.com/tenants/hdfc/logo.png",
      "editable": false
    },
    {
      "id": "text-phone",
      "type": "text",
      "x": 120, "y": 380,
      "text": "+91 98765 43210",
      "fontSize": 16,
      "color": "#F5C842",
      "editable": true
    }
  ]
}
```

#### 5.2 Save Poster Draft
```
POST /api/posters/draft
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "templateId": 42,
  "layerOverrides": {
    "text-agent-name": { "text": "Prashant Chandratre" },
    "text-phone": { "text": "+91 98800 12345", "color": "#FFD700" }
  },
  "canvasData": "base64_png_string_here"
}

Response 201:
{
  "draftId": "uuid",
  "previewUrl": "https://cdn.pbpartners.com/drafts/uuid/preview.png"
}
```

#### 5.3 Export Poster (Final)
```
POST /api/posters/export
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "draftId": "uuid",
  "format": "png",
  "addWatermark": false,
  "resolution": "2x"
}

Response 202:
{
  "exportId": "uuid",
  "status": "processing",
  "pollUrl": "/api/posters/export/uuid/status"
}
```

#### 5.4 Poll Export Status
```
GET /api/posters/export/:exportId/status

Response 200:
{
  "status": "done",
  "downloadUrl": "https://cdn.pbpartners.com/exports/uuid/poster_2x.png",
  "expiresAt": "2026-06-26T10:00:00Z"
}
```

#### 5.5 AI Caption Generation
```
POST /api/ai/generate-caption
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "category": "Car Insurance",
  "language": "Marathi",
  "tone": "professional",
  "posterContext": "Diwali offer - 10% discount on premium"
}

Response 200:
{
  "caption": "या दिवाळीत तुमच्या गाडीचे संरक्षण करा! 🚗✨ SBI कार विमा - विश्वासाचे कवच.",
  "hashtags": ["#SBICarInsurance", "#Diwali2026", "#PBPartners", "#Insurance"]
}
```

#### 5.6 Claim Submission with Photos
```
POST /api/claims
Authorization: Bearer <token>
Content-Type: multipart/form-data

Fields:
  policyId: "uuid"
  claimType: "accident"
  description: "Front bumper damage at junction"
  photos: [File, File, File]  (max 5 photos, 10MB each)

Response 201:
{
  "claimId": "uuid",
  "claimNumber": "CLM-2026-00412",
  "status": "submitted",
  "estimatedResolutionDays": 7
}
```

---

## 6. SUBSCRIPTION PLAN

| Plan | Price | Features |
|---|---|---|
| **Free** | ₹0 | 5 poster downloads/month, watermark, no AI |
| **Pro (Trial)** | ₹0 for 7 days | Full access, no watermark |
| **Pro Yearly** | ₹499/year | Unlimited downloads, no watermark, AI captions, HD export |
| **Business** | ₹1,999/year | CRM, policy viewer, claim submission, 5 team members |
| **White-Label** | Custom | Full re-brand, custom domain, admin panel |

### Payment Flow (Razorpay)
```
User taps "Go Pro" → POST /api/subscriptions/create-order
→ Razorpay Order ID returned
→ Native Razorpay SDK opens payment sheet
→ Webhook: POST /api/webhooks/razorpay (HMAC verified)
→ Update user.is_premium = true
→ Send confirmation SMS
```

---

## 7. IMPLEMENTATION ROADMAP

### Phase 1 — Core MVP (Estimated: 320 hours / ~8 weeks)
> Goal: Working app with auth, poster editor, and subscription.

| Task | Hours |
|---|---|
| Multi-tenant DB schema + migrations | 12 |
| OTP Auth (MSG91 integration) + JWT | 16 |
| Tenant config loader (middleware) | 8 |
| Template CRUD API (existing, extend) | 12 |
| Enhanced poster editor (Skia canvas) | 40 |
| Drag-and-drop text, color, font picker | 24 |
| ViewShot export + gallery save | 8 |
| WhatsApp share + watermark logic | 8 |
| Razorpay subscription integration | 20 |
| 7-day trial logic | 8 |
| S3/R2 file upload pipeline | 16 |
| DashboardScreen UI (6 sections) | 12 |
| Festival Calendar backend + CRON | 16 |
| Birthday/Anniversary auto-reminder | 12 |
| Admin panel: tenant management | 24 |
| Expo EAS build + TestFlight/Play | 16 |
| QA + bug fixes | 48 |

### Phase 2 — Business Core (Estimated: 280 hours / ~7 weeks)
> Goal: Insurance CRM, policy viewer, claim submission.

| Task | Hours |
|---|---|
| Customer CRM (add/search/tag) | 32 |
| Policy digital viewer (PDF render) | 24 |
| Claim submission with photo upload | 28 |
| AI caption generator (GPT-4o) | 16 |
| DALL-E image generation | 16 |
| Push notifications (Expo Notifications) | 20 |
| Language switching (en/mr/hi) | 24 |
| Animated video maker (template-based) | 48 |
| BullMQ job queue for video render | 20 |
| Analytics dashboard (admin) | 32 |
| Google OAuth login | 12 |
| Performance + load testing | 8 |

### Phase 3 — White-Label & Scale (Estimated: 200 hours / ~5 weeks)
> Goal: Sell to other industries. Real Estate, Finance, etc.

| Task | Hours |
|---|---|
| Custom domain resolver middleware | 16 |
| Tenant onboarding wizard (admin) | 24 |
| Industry template packs (Real Estate, Finance) | 32 |
| Reseller partner portal | 32 |
| Revenue share / commission tracking | 24 |
| Japanese language (i18n) | 16 |
| Stripe global payment integration | 20 |
| SOC2/GDPR compliance audit | 16 |
| App Store + Play Store full launch | 20 |

**Total Estimated: ~800 hours (~20 weeks solo, ~10 weeks with 2-dev team)**

---

## 8. SECURITY CONSIDERATIONS

- **Row-Level Security (RLS):** Every query scoped by `tenant_id`. PostgreSQL RLS policies enforce this at DB level.
- **JWT + Refresh Tokens:** Access token (15min), refresh token (30 days, HttpOnly cookie on web).
- **OTP Rate Limiting:** Max 3 OTP attempts per 10 minutes per phone number.
- **File Upload:** MIME-type validation + virus scan (ClamAV) before S3 upload.
- **Webhook HMAC:** All Razorpay/Stripe webhooks verified with HMAC-SHA256.
- **Secret Management:** All API keys in environment secrets (never in code).

---

## 9. SCALABILITY PLAN

| Users | Architecture |
|---|---|
| 0–1,000 | Single Express server + managed Postgres (Railway/Render) |
| 1,000–10,000 | Add Redis cache, CDN for assets, BullMQ for jobs |
| 10,000–100,000 | Horizontal Express replicas, read replicas for DB, S3 + CloudFront |
| 100,000+ | Microservices: separate Auth, Poster, Notification, CRM services |

---

*Document maintained in: `PRD_PBPartners_WhiteLabel_SaaS.md`*
