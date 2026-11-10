# Cây repository thực tế

Sinh từ filesystem ngày 10/11/2026; bỏ .git, node_modules, dist, .env.local và kết quả test tạm.

```text
StudyMatch/
├── docs/
│   ├── verification/
│   │   ├── browser.json
│   │   ├── desktop.png
│   │   ├── live-mobile.png
│   │   ├── live-results.json
│   │   └── mobile.png
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── DEVELOPMENT.md
│   ├── FIGMA_MIGRATION.md
│   ├── IMPLEMENTATION_STATUS.md
│   ├── PRODUCT_RULES.md
│   ├── REPOSITORY_TREE.md
│   ├── source-manifest.json
│   ├── SUPABASE_SETUP.md
│   └── VERIFICATION.md
├── public/
│   ├── images/
│   │   └── README.md
│   └── favicon.svg
├── scripts/
│   └── install-dependencies.ps1
├── src/
│   ├── app/
│   │   ├── guards/
│   │   │   ├── AuthGuard.tsx
│   │   │   └── OnboardingGuard.tsx
│   │   ├── App.tsx
│   │   ├── providers.tsx
│   │   └── router.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   └── AppLayout.tsx
│   │   └── shared/
│   │       ├── Feedback.tsx
│   │       └── Loading.tsx
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── LiveLogin.tsx
│   │   │   │   └── Login.tsx
│   │   │   └── hooks/
│   │   │       └── useAuth.tsx
│   │   ├── chat/
│   │   │   ├── components/
│   │   │   │   └── MessagesPage.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useMessages.ts
│   │   │   └── repositories/
│   │   │       └── chatRepository.ts
│   │   ├── documents/
│   │   │   ├── components/
│   │   │   │   └── LibraryScreen.tsx
│   │   │   └── repositories/
│   │   │       └── resourceRepository.ts
│   │   ├── home/
│   │   │   └── components/
│   │   │       └── HomePage.tsx
│   │   ├── invitations/
│   │   │   ├── repositories/
│   │   │   │   └── invitationRepository.ts
│   │   │   └── services/
│   │   │       └── invitationRules.ts
│   │   ├── matching/
│   │   │   ├── components/
│   │   │   │   └── MatchPage.tsx
│   │   │   ├── domain/
│   │   │   │   ├── matching.ts
│   │   │   │   ├── timezone.ts
│   │   │   │   └── weights.ts
│   │   │   ├── hooks/
│   │   │   │   └── useMatches.ts
│   │   │   ├── repositories/
│   │   │   │   └── matchingRepository.ts
│   │   │   └── services/
│   │   │       ├── matchingService.ts
│   │   │       └── scoreProfiles.ts
│   │   ├── notifications/
│   │   │   ├── components/
│   │   │   │   └── NotificationBell.tsx
│   │   │   └── repositories/
│   │   │       └── notificationRepository.ts
│   │   ├── onboarding/
│   │   │   └── components/
│   │   │       └── OnboardingPage.tsx
│   │   ├── pricing/
│   │   │   └── components/
│   │   │       └── PricingPage.tsx
│   │   ├── profile/
│   │   │   ├── components/
│   │   │   │   ├── ProfilePage.tsx
│   │   │   │   └── ProfileScreens.tsx
│   │   │   ├── hooks/
│   │   │   │   └── ProfileProvider.tsx
│   │   │   └── services/
│   │   │       └── profileService.ts
│   │   ├── progress/
│   │   │   ├── components/
│   │   │   │   └── ProgressPage.tsx
│   │   │   └── services/
│   │   │       └── progress.ts
│   │   ├── scheduling/
│   │   │   ├── components/
│   │   │   │   ├── SessionForm.tsx
│   │   │   │   └── SessionsPage.tsx
│   │   │   ├── domain/
│   │   │   │   └── session.ts
│   │   │   └── repositories/
│   │   │       └── sessionRepository.ts
│   │   ├── study-room/
│   │   │   ├── components/
│   │   │   │   └── RoomPage.tsx
│   │   │   ├── domain/
│   │   │   │   └── timer.ts
│   │   │   ├── hooks/
│   │   │   │   ├── usePomodoro.ts
│   │   │   │   └── useRoom.ts
│   │   │   └── repositories/
│   │   │       └── roomRepository.ts
│   │   ├── subjects/
│   │   │   └── repositories/
│   │   │       └── catalogRepository.ts
│   │   └── workspace/
│   │       └── hooks/
│   │           └── useWorkspace.tsx
│   ├── lib/
│   │   ├── config/
│   │   │   └── env.ts
│   │   ├── supabase/
│   │   │   ├── auth.ts
│   │   │   ├── authStorage.ts
│   │   │   ├── client.ts
│   │   │   ├── rpc.ts
│   │   │   └── storage.ts
│   │   └── utils/
│   │       ├── dates.ts
│   │       └── errors.ts
│   ├── styles/
│   │   └── index.css
│   ├── types/
│   │   ├── domain.ts
│   │   └── product.ts
│   ├── main.tsx
│   └── vite-env.d.ts
├── supabase/
│   ├── migrations/
│   │   ├── 202611040001_foundation.sql
│   │   └── 202611100001_product.sql
│   ├── README.md
│   └── seed.sql
├── tests/
│   ├── config/
│   │   ├── authStorage.test.ts
│   │   └── environment.test.ts
│   ├── database/
│   │   └── security.test.ts
│   ├── e2e/
│   │   ├── localBackend.ts
│   │   └── product.spec.ts
│   ├── invitations/
│   │   └── rules.test.ts
│   ├── matching/
│   │   ├── matching.test.ts
│   │   └── timezone.test.ts
│   ├── progress/
│   │   └── progress.test.ts
│   ├── scheduling/
│   │   └── session.test.ts
│   └── study-room/
│       └── timer.test.ts
├── .env.example
├── .gitignore
├── .prettierrc.json
├── index.html
├── package-lock.json
├── package.json
├── playwright.config.ts
├── README.md
├── tsconfig.json
├── vercel.json
├── vite.config.ts
└── vitest.config.ts
```
