# Trial Class Wizard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a step-by-step wizard at `/admin/convites/novo` that creates a trial class with course, module rules, content access, feature permissions, and invite link in one unified flow.

**Architecture:** Single page component with 7 steps rendered as a stepper. Each step saves to the database on "Next" so progress isn't lost. Uses existing services (classService, inviteService, contentAccessService, moduleRulesService, classPermissionsService). The wizard replaces the need to visit 5+ separate admin pages.

**Tech Stack:** React, Shadcn/UI (Card, Button, Input, Switch, Checkbox, Progress, Tabs), Supabase, existing services

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/pages/admin/invites/TrialClassWizard.tsx` | Create | Main wizard component with stepper + 7 steps |
| `src/App.tsx` | Modify | Add route `/admin/convites/novo` |

All service functions already exist — no new services needed.

---

### Task 1: Create wizard page with all 7 steps

**Files:**
- Create: `src/pages/admin/invites/TrialClassWizard.tsx`
- Modify: `src/App.tsx` (add lazy import + route)

**Steps:**

Step 1 - Dados Basicos: name, description, start_date, end_date, access_duration_days (class_type auto = 'trial')
Step 2 - Curso: select one course from video_courses
Step 3 - Modulos e Aulas: show modules from selected course, per-module rule_type (free/blocked/hidden), expandable lessons with override (free within blocked module)
Step 4 - Feature Permissions: checkboxes for video_lessons, flashcards, quiz, essays, evercast, live_events
Step 5 - Conteudo: flashcard topics, quiz topics, acervo, simulados, redacao limit, comunidade
Step 6 - Convite: title, slug, max_slots, cover_image
Step 7 - Revisao: summary of all config, confirm button, show generated link

**Save strategy:** Each step saves on "Next". Step 1 creates the class. Steps 2-6 update related tables. Step 7 creates the invite.

**Navigation:** Back/Next buttons, step indicator at top, can go back to previous steps.
