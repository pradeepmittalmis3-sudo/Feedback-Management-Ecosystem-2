
## 🏗️ Rajmandir Feedback Management System

### Flow Architecture
```
Google Form → Google Sheet → Lovable Cloud DB (sync) → Web App Dashboard
```

### Form Fields (from Google Form)
| Field | Type |
|-------|------|
| Name | Text |
| Mobile Number | Text |
| Store Location | Dropdown (40+ stores) |
| Staff Behavior Rating | 1-5 scale |
| Staff Service Rating | 1-5 scale |
| Store Satisfaction Rating | 1-5 scale |
| Price Challenge Satisfied | Yes/No |
| Bill Received | Yes/No |
| Complaint | Text (optional) |
| Feedback | Text (optional) |
| Suggestions | Text (optional) |
| Product Unavailable | Text (optional) |

### Features to Build

**1. Login System**
- Email/password login via Lovable Cloud auth
- Protected routes — only logged-in admins can access dashboard
- Simple login page with Rajmandir branding

**2. Dashboard**
- Summary cards: Total feedbacks, Average ratings, Pending complaints, Stores count
- Recent feedbacks table with all form fields
- Rating breakdown charts (Staff Behavior, Service, Store)
- Store-wise performance overview

**3. Filters**
- Filter by Store Location
- Filter by Date Range
- Filter by Rating (low/high)
- Filter by Status (New/In Progress/Resolved)
- Search by customer name or mobile

**4. Status Update**
- Each feedback entry gets a status: `New` → `In Progress` → `Resolved`
- Admin can update status with notes
- Status history tracking

### Tech Stack
- **Frontend**: React + Tailwind + shadcn/ui
- **Backend**: Lovable Cloud (Supabase) — DB + Auth
- **Data Sync**: Google Sheet → DB via Edge Function (webhook/scheduled)

### Database Tables
1. `feedbacks` — all form responses with status field
2. `user_roles` — admin role management
3. `status_updates` — status change history with notes

### Pages
1. `/login` — Admin login
2. `/` — Dashboard with summary cards + charts
3. `/feedbacks` — Full feedback list with filters
4. `/feedbacks/:id` — Single feedback detail + status update
