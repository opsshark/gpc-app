# Auth & Access Control Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the authentication and access-control foundation for the GPC members-only web app — request access, staff approval, login, and route protection.

**Architecture:** Supabase Auth handles identity (email/password + magic link). A `profiles` table extends `auth.users` with member data and an `approved` status. A Next.js middleware checks auth + approval on every request, redirecting unapproved users to a pending screen. Staff see an approval dashboard at `/admin/approvals`.

**Tech Stack:** Next.js 16 (App Router), Supabase (Auth + Postgres + RLS), Tailwind 4, shadcn/ui, Zod, React Hook Form, Vitest + React Testing Library

**Existing Project:** Fresh Next.js 16 scaffold at `/Users/tfa/Dev/gpc-app` with Tailwind 4 and React 19. No Supabase, shadcn, or testing framework installed yet.

**Brand Reference:** See `/Users/tfa/.claude/projects/-Users-tfa-Dev-gpc-app/memory/project_branding.md` — colors (#231F21, #EEEFEA, #637678, #F7F7F7, #EAE7E1, #C3DBD8, #E5C888), fonts (Wensley for headings, Acumin Pro for body), GPC logo assets in `/assets/`.

---

## Chunk 1: Project Dependencies & Tooling Setup

### Task 1: Install Core Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Supabase client libraries**

```bash
cd /Users/tfa/Dev/gpc-app
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Install shadcn/ui prerequisites and init**

```bash
npx shadcn@latest init -d
```

Accept defaults. This adds `components.json`, `src/components/ui/`, and `src/lib/utils.ts`.

- [ ] **Step 3: Add shadcn components we need**

```bash
npx shadcn@latest add button input label card form sonner
```

- [ ] **Step 4: Install form and validation libraries**

```bash
npm install zod react-hook-form @hookform/resolvers
```

- [ ] **Step 5: Install testing framework**

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json components.json src/components/ src/lib/
git commit -m "chore: install supabase, shadcn/ui, zod, react-hook-form, vitest"
```

---

### Task 2: Configure Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Modify: `tsconfig.json` (add vitest types)

- [ ] **Step 1: Create vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    css: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 2: Create test setup file**

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Add test script to package.json**

Add to `scripts` in `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Add vitest globals type to tsconfig.json**

In `tsconfig.json`, add `"vitest/globals"` to the `compilerOptions.types` array:

```json
"compilerOptions": {
  "types": ["vitest/globals"],
  ...
}
```

- [ ] **Step 5: Verify vitest runs (no tests yet, should exit cleanly)**

```bash
npx vitest run
```

Expected: "No test files found" or exits with 0.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts src/test/setup.ts package.json package-lock.json
git commit -m "chore: configure vitest with jsdom and react testing library"
```

---

### Task 3: Configure Supabase Client Utilities

**Files:**
- Create: `src/lib/supabase/client.ts` (browser client)
- Create: `src/lib/supabase/server.ts` (server client)
- Create: `src/lib/supabase/middleware.ts` (middleware client)
- Create: `.env.local.example`

- [ ] **Step 1: Create `.env.local.example`**

Create `.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 2: Create browser client**

Create `src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Create server client**

Create `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 4: Create middleware client**

Create `src/lib/supabase/middleware.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes that don't require auth
  const publicRoutes = ["/login", "/request-access", "/auth/callback", "/pending-approval"];
  const isPublicRoute = publicRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  // If not authenticated and not on a public route, redirect to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If authenticated, check approval status
  if (user && !isPublicRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("approved, role")
      .eq("id", user.id)
      .single();

    // If no profile exists or not approved, redirect to pending page
    if (!profile || !profile.approved) {
      const url = request.nextUrl.clone();
      url.pathname = "/pending-approval";
      return NextResponse.redirect(url);
    }

    // If on admin route, check role
    if (
      request.nextUrl.pathname.startsWith("/admin") &&
      profile?.role !== "admin" &&
      profile?.role !== "leader"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  // If authenticated and on login/request-access, redirect to home
  if (user && (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/request-access")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("approved")
      .eq("id", user.id)
      .single();

    if (profile?.approved) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
```

- [ ] **Step 5: Create the Next.js middleware entry point**

Create `src/middleware.ts`:

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/ src/middleware.ts .env.local.example
git commit -m "feat: configure supabase client utilities and auth middleware"
```

---

## Chunk 2: Database Schema & Auth Callback

### Task 4: Create Supabase Database Migration

**Files:**
- Create: `supabase/migrations/00001_create_profiles.sql`

**Note:** This migration will be run in the Supabase dashboard SQL editor or via Supabase CLI. The implementer should have a Supabase project created and the URL + anon key in `.env.local`.

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/00001_create_profiles.sql`:

```sql
-- Create profiles table extending auth.users
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null default '',
  phone text default '',
  photo_url text default '',
  approved boolean not null default false,
  role text not null default 'member' check (role in ('member', 'leader', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policy: Users can read their own profile
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Policy: Approved users can read all approved profiles (for directory)
create policy "Approved users can read approved profiles"
  on public.profiles for select
  using (
    approved = true
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and approved = true
    )
  );

-- Policy: Users can update their own profile (but not role or approved)
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
    and approved = (select approved from public.profiles where id = auth.uid())
  );

-- Policy: Admins can read all profiles
create policy "Admins can read all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Policy: Admins can update any profile (for approvals)
create policy "Admins can update any profile"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Policy: Admins can delete profiles (for denying access requests)
create policy "Admins can delete profiles"
  on public.profiles for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Trigger: auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger: auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_profile_updated
  before update on public.profiles
  for each row execute function public.handle_updated_at();
```

- [ ] **Step 2: Commit**

```bash
git add supabase/
git commit -m "feat: add profiles table migration with RLS policies"
```

---

### Task 5: Auth Callback Route

**Files:**
- Create: `src/app/auth/callback/route.ts`

- [ ] **Step 1: Create the auth callback handler**

Create `src/app/auth/callback/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if user is approved
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("approved")
          .eq("id", user.id)
          .single();

        if (profile && !profile.approved) {
          return NextResponse.redirect(`${origin}/pending-approval`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/auth/
git commit -m "feat: add supabase auth callback route"
```

---

## Chunk 3: Shared Auth Validation & Actions

### Task 6: Shared Validation Schemas

**Files:**
- Create: `src/lib/validations/auth.ts`
- Create: `src/lib/validations/auth.test.ts`

- [ ] **Step 1: Write failing tests for validation schemas**

Create `src/lib/validations/auth.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { requestAccessSchema, loginSchema } from "./auth";

describe("requestAccessSchema", () => {
  it("validates a correct request", () => {
    const result = requestAccessSchema.safeParse({
      email: "john@example.com",
      fullName: "John Smith",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty email", () => {
    const result = requestAccessSchema.safeParse({
      email: "",
      fullName: "John Smith",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = requestAccessSchema.safeParse({
      email: "not-an-email",
      fullName: "John Smith",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = requestAccessSchema.safeParse({
      email: "john@example.com",
      fullName: "",
    });
    expect(result.success).toBe(false);
  });

  it("trims whitespace from name", () => {
    const result = requestAccessSchema.safeParse({
      email: "john@example.com",
      fullName: "  John Smith  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("John Smith");
    }
  });

  it("rejects whitespace-only name", () => {
    const result = requestAccessSchema.safeParse({
      email: "john@example.com",
      fullName: "   ",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("validates a correct login", () => {
    const result = loginSchema.safeParse({
      email: "john@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "bad",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/tfa/Dev/gpc-app && npx vitest run src/lib/validations/auth.test.ts
```

Expected: FAIL — module `./auth` not found.

- [ ] **Step 3: Implement validation schemas**

Create `src/lib/validations/auth.ts`:

```ts
import { z } from "zod";

export const requestAccessSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required"),
});

export type RequestAccessInput = z.infer<typeof requestAccessSchema>;

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
});

export type LoginInput = z.infer<typeof loginSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/tfa/Dev/gpc-app && npx vitest run src/lib/validations/auth.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/
git commit -m "feat: add zod validation schemas for auth forms"
```

---

### Task 7: Server Actions for Auth

**Files:**
- Create: `src/app/(auth)/actions.ts`

- [ ] **Step 1: Create auth server actions**

Create `src/app/(auth)/actions.ts`:

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { requestAccessSchema, loginSchema } from "@/lib/validations/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export type AuthActionState = {
  error?: string;
  success?: boolean;
};

export async function requestAccess(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const rawData = {
    email: formData.get("email") as string,
    fullName: formData.get("fullName") as string,
  };

  const parsed = requestAccessSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = await createClient();
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? "";

  // Sign up the user — they'll get a confirmation email
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: crypto.randomUUID(), // Random password; they'll use magic link to log in
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: "Something went wrong. Please try again." };
  }

  // Note: Supabase may return a fake success for duplicate emails when
  // email confirmation is enabled (to prevent email enumeration).
  // The user will simply not receive a confirmation email in that case.
  return { success: true };
}

export async function login(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const rawData = {
    email: formData.get("email") as string,
  };

  const parsed = loginSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = await createClient();
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? "";

  // Send magic link
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: "Something went wrong. Please try again." };
  }

  return { success: true };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(auth\)/
git commit -m "feat: add server actions for request-access, login, and logout"
```

---

## Chunk 4: Auth UI Pages

### Task 8: Auth Layout (shared by login + request-access)

**Files:**
- Create: `src/app/(auth)/layout.tsx`

- [ ] **Step 1: Create auth layout**

Create `src/app/(auth)/layout.tsx`:

```tsx
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F7F7] px-4">
      <div className="mb-8">
        <Image
          src="/logo.png"
          alt="Grace Presbyterian Church"
          width={80}
          height={80}
          priority
        />
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Copy GPC logo to public directory**

```bash
cp "assets/PNG (Transparent)/GPC__Icon.png" public/logo.png
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/layout.tsx public/logo.png
git commit -m "feat: add shared auth layout with GPC logo"
```

---

### Task 9: Request Access Page

**Files:**
- Create: `src/app/(auth)/request-access/page.tsx`
- Create: `src/components/auth/request-access-form.tsx`

- [ ] **Step 1: Create the request access form component**

Create `src/components/auth/request-access-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { requestAccess, type AuthActionState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export function RequestAccessForm() {
  const [state, formAction, isPending] = useActionState<AuthActionState, FormData>(
    requestAccess,
    {}
  );

  if (state.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-[#231F21]">
            Check Your Email
          </CardTitle>
          <CardDescription className="text-center">
            We sent a confirmation link to your email. Click it to complete your
            request. A staff member will review and approve your access.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center text-[#231F21]">
          Request Access
        </CardTitle>
        <CardDescription className="text-center">
          Enter your details to request access to the GPC app. A staff member
          will review your request.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              name="fullName"
              type="text"
              placeholder="John Smith"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="john@example.com"
              required
            />
          </div>
          {state.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}
          <Button
            type="submit"
            className="w-full bg-[#637678] hover:bg-[#4e5e60] text-white"
            disabled={isPending}
          >
            {isPending ? "Submitting..." : "Request Access"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-[#637678]">
          Already have access?{" "}
          <Link href="/login" className="font-medium text-[#231F21] underline">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create the request access page**

Create `src/app/(auth)/request-access/page.tsx`:

```tsx
import { RequestAccessForm } from "@/components/auth/request-access-form";

export default function RequestAccessPage() {
  return <RequestAccessForm />;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/request-access/ src/components/auth/
git commit -m "feat: add request access page and form"
```

---

### Task 10: Login Page

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/components/auth/login-form.tsx`

- [ ] **Step 1: Create the login form component**

Create `src/components/auth/login-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { login, type AuthActionState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState<AuthActionState, FormData>(
    login,
    {}
  );

  if (state.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-[#231F21]">
            Check Your Email
          </CardTitle>
          <CardDescription className="text-center">
            We sent a magic link to your email. Click it to log in.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center text-[#231F21]">
          Welcome Back
        </CardTitle>
        <CardDescription className="text-center">
          Enter your email to receive a login link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="john@example.com"
              required
            />
          </div>
          {state.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}
          <Button
            type="submit"
            className="w-full bg-[#637678] hover:bg-[#4e5e60] text-white"
            disabled={isPending}
          >
            {isPending ? "Sending link..." : "Send Magic Link"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-[#637678]">
          Don&apos;t have access?{" "}
          <Link
            href="/request-access"
            className="font-medium text-[#231F21] underline"
          >
            Request access
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create the login page**

Create `src/app/(auth)/login/page.tsx`:

```tsx
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return <LoginForm />;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/login/ src/components/auth/login-form.tsx
git commit -m "feat: add login page with magic link form"
```

---

### Task 11: Pending Approval Page

**Files:**
- Create: `src/app/(auth)/pending-approval/page.tsx`

- [ ] **Step 1: Create the pending approval page**

Create `src/app/(auth)/pending-approval/page.tsx`:

```tsx
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/(auth)/actions";

export default function PendingApprovalPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-[#231F21]">Access Pending</CardTitle>
        <CardDescription>
          Your request has been received. A staff member will review and approve
          your access shortly. You&apos;ll receive an email when you&apos;re approved.
        </CardDescription>
        <form action={logout} className="pt-4">
          <Button
            type="submit"
            variant="outline"
            className="text-[#637678] border-[#637678]"
          >
            Sign Out
          </Button>
        </form>
      </CardHeader>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(auth\)/pending-approval/
git commit -m "feat: add pending approval page"
```

---

## Chunk 5: Admin Approval Dashboard

### Task 12: Admin Actions

**Files:**
- Create: `src/app/admin/actions.ts`

- [ ] **Step 1: Create admin server actions**

Create `src/app/admin/actions.ts`:

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function approveUser(userId: string) {
  const supabase = await createClient();

  // Verify caller is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (callerProfile?.role !== "admin") {
    throw new Error("Not authorized");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ approved: true })
    .eq("id", userId);

  if (error) throw new Error("Failed to approve user");

  revalidatePath("/admin/approvals");
}

export async function denyUser(userId: string) {
  const supabase = await createClient();

  // Verify caller is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (callerProfile?.role !== "admin") {
    throw new Error("Not authorized");
  }

  // Delete the profile (the auth.users entry remains but they can't access the app)
  // Note: supabase.auth.admin.deleteUser requires the service role key, not the anon key.
  // For now, we just remove the profile. The orphaned auth.users entry is harmless.
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId);

  if (error) throw new Error("Failed to deny user");

  revalidatePath("/admin/approvals");
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/
git commit -m "feat: add admin server actions for approve/deny users"
```

---

### Task 13: Admin Approvals Page

**Files:**
- Create: `src/app/admin/approvals/page.tsx`
- Create: `src/components/admin/approval-card.tsx`

- [ ] **Step 1: Create the approval card component**

Create `src/components/admin/approval-card.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { approveUser, denyUser } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ApprovalCardProps = {
  user: {
    id: string;
    email: string;
    full_name: string;
    created_at: string;
  };
};

export function ApprovalCard({ user }: ApprovalCardProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg text-[#231F21]">
          {user.full_name || "No name provided"}
        </CardTitle>
        <CardDescription>{user.email}</CardDescription>
        <CardDescription>
          Requested:{" "}
          {new Date(user.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button
          onClick={() => startTransition(() => approveUser(user.id))}
          disabled={isPending}
          className="bg-[#637678] hover:bg-[#4e5e60] text-white"
        >
          {isPending ? "..." : "Approve"}
        </Button>
        <Button
          onClick={() => startTransition(() => denyUser(user.id))}
          disabled={isPending}
          variant="outline"
          className="text-red-600 border-red-300 hover:bg-red-50"
        >
          {isPending ? "..." : "Deny"}
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create the approvals page**

Create `src/app/admin/approvals/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { ApprovalCard } from "@/components/admin/approval-card";

export default async function ApprovalsPage() {
  const supabase = await createClient();

  const { data: pendingUsers } = await supabase
    .from("profiles")
    .select("id, email, full_name, created_at")
    .eq("approved", false)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-[#231F21]">
        Pending Approvals
      </h1>
      {!pendingUsers || pendingUsers.length === 0 ? (
        <p className="text-[#637678]">No pending access requests.</p>
      ) : (
        <div className="space-y-4">
          {pendingUsers.map((user) => (
            <ApprovalCard key={user.id} user={user} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/approvals/ src/components/admin/
git commit -m "feat: add admin approvals page with approve/deny actions"
```

---

## Chunk 6: Authenticated Home & Layout

### Task 14: Authenticated Layout with Navigation

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/components/nav/bottom-nav.tsx`

- [ ] **Step 1: Create the bottom navigation component**

Create `src/components/nav/bottom-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/directory", label: "Directory", icon: "👥" },
  { href: "/sermons", label: "Sermons", icon: "🎧" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#EAE7E1] bg-white">
      <div className="mx-auto flex max-w-lg">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center py-2 text-xs ${
                isActive
                  ? "text-[#637678] font-medium"
                  : "text-[#231F21]/50"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

**Note:** The emoji icons are placeholders. Replace with proper icons (lucide-react or SVGs) during the UI polish phase.

- [ ] **Step 2: Create the authenticated app layout**

Create `src/app/(app)/layout.tsx`:

```tsx
import { BottomNav } from "@/components/nav/bottom-nav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <main className="pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/ src/components/nav/
git commit -m "feat: add authenticated app layout with bottom navigation"
```

---

### Task 15: Home Page Placeholder

**Files:**
- Modify: `src/app/(app)/page.tsx` (move existing `src/app/page.tsx` into route group)

- [ ] **Step 1: Move and rewrite the home page**

Delete `src/app/page.tsx` and create `src/app/(app)/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null; // Middleware ensures this won't happen

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-[#231F21]">
        Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
      </h1>
      <p className="mt-2 text-[#637678]">
        Events and announcements coming soon.
      </p>
      {profile?.role === "admin" && (
        <a
          href="/admin/approvals"
          className="mt-4 inline-block text-sm text-[#637678] underline"
        >
          Admin: View pending approvals
        </a>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create placeholder pages for nav items**

Create `src/app/(app)/directory/page.tsx`:

```tsx
export default function DirectoryPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-[#231F21]">Directory</h1>
      <p className="mt-2 text-[#637678]">Member directory coming soon.</p>
    </div>
  );
}
```

Create `src/app/(app)/sermons/page.tsx`:

```tsx
export default function SermonsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-[#231F21]">Sermons</h1>
      <p className="mt-2 text-[#637678]">Sermon archive coming soon.</p>
    </div>
  );
}
```

Create `src/app/(app)/settings/page.tsx`:

```tsx
import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-[#231F21]">Settings</h1>
      <p className="mt-2 text-[#637678]">Notification preferences coming soon.</p>
      <form action={logout} className="mt-8">
        <Button
          type="submit"
          variant="outline"
          className="text-red-600 border-red-300"
        >
          Sign Out
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git rm src/app/page.tsx
git add src/app/\(app\)/
git commit -m "feat: add authenticated home page and placeholder routes"
```

---

### Task 16: Update Root Layout for GPC Branding

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update globals.css with GPC brand tokens**

Replace `src/app/globals.css`:

```css
@import "tailwindcss";

:root {
  --background: #F7F7F7;
  --foreground: #231F21;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
}

body {
  background: var(--background);
  color: var(--foreground);
  /* Acumin Pro requires font files — fallback to system sans-serif for now.
     Font loading will be added in a future plan when design polish begins. */
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 2: Update layout.tsx — remove Geist fonts, set GPC metadata**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GPC — Grace Presbyterian Church",
  description: "Grace Presbyterian Church member app",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: update root layout and globals with GPC branding"
```

---

## Chunk 7: Smoke Tests & Final Verification

### Task 17: Write Integration Smoke Tests

**Files:**
- Create: `src/lib/validations/auth.test.ts` (already done in Task 6)
- Create: `src/components/auth/request-access-form.test.tsx`
- Create: `src/components/auth/login-form.test.tsx`

- [ ] **Step 1: Write request access form render test**

Create `src/components/auth/request-access-form.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RequestAccessForm } from "./request-access-form";

// Mock the server action
vi.mock("@/app/(auth)/actions", () => ({
  requestAccess: vi.fn().mockResolvedValue({}),
}));

describe("RequestAccessForm", () => {
  it("renders the form fields", () => {
    render(<RequestAccessForm />);
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request access/i })).toBeInTheDocument();
  });

  it("has a link to login page", () => {
    render(<RequestAccessForm />);
    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute(
      "href",
      "/login"
    );
  });
});
```

- [ ] **Step 2: Write login form render test**

Create `src/components/auth/login-form.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginForm } from "./login-form";

// Mock the server action
vi.mock("@/app/(auth)/actions", () => ({
  login: vi.fn().mockResolvedValue({}),
}));

describe("LoginForm", () => {
  it("renders the email field and submit button", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send magic link/i })
    ).toBeInTheDocument();
  });

  it("has a link to request access page", () => {
    render(<LoginForm />);
    expect(screen.getByRole("link", { name: /request access/i })).toHaveAttribute(
      "href",
      "/request-access"
    );
  });
});
```

- [ ] **Step 3: Run all tests**

```bash
cd /Users/tfa/Dev/gpc-app && npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 4: Run build to verify no TypeScript errors**

```bash
cd /Users/tfa/Dev/gpc-app && npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/*.test.tsx
git commit -m "test: add smoke tests for auth form components"
```

---

### Task 18: Manual Testing Checklist

After all code is in place and tests pass, verify these flows manually with a running Supabase project:

- [ ] **Step 1:** Navigate to `/` — redirected to `/login` (not authenticated)
- [ ] **Step 2:** Navigate to `/request-access` — see the form, fill in name + email, submit
- [ ] **Step 3:** Check email for confirmation link, click it
- [ ] **Step 4:** After confirm, redirected to `/pending-approval` (not yet approved)
- [ ] **Step 5:** In Supabase dashboard, manually set a user's `role` to `admin` and `approved` to `true`
- [ ] **Step 6:** Log in as admin, navigate to `/admin/approvals` — see pending user
- [ ] **Step 7:** Approve the user — they disappear from the list
- [ ] **Step 8:** Log in as the approved user — see the home page with bottom nav
- [ ] **Step 9:** Navigate between Home, Directory, Sermons, Settings tabs
- [ ] **Step 10:** Sign out from Settings — redirected to `/login`
