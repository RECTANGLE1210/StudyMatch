# Cây repository thực tế

Sinh từ filesystem sau triển khai; không liệt kê .git, node_modules, dist và .env.local.

```text
StudyMatch/
├── docs/
│   ├── verification/
│   │   ├── browser.json
│   │   ├── desktop.png
│   │   └── mobile.png
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── DEVELOPMENT.md
│   ├── FIGMA_MIGRATION.md
│   ├── IMPLEMENTATION_STATUS.md
│   ├── REPOSITORY_TREE.md
│   ├── source-manifest.json
│   └── VERIFICATION.md
├── public/
│   └── images/
│       └── README.md
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
│   │       └── Loading.tsx
│   ├── demo/
│   │   ├── App.tsx
│   │   ├── library.tsx
│   │   └── profile.tsx
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── LiveLogin.tsx
│   │   │   │   └── Login.tsx
│   │   │   └── hooks/
│   │   │       └── useAuth.tsx
│   │   ├── chat/
│   │   │   └── repositories/
│   │   │       └── chatRepository.ts
│   │   ├── documents/
│   │   │   └── repositories/
│   │   │       └── resourceRepository.ts
│   │   ├── invitations/
│   │   │   ├── repositories/
│   │   │   │   └── invitationRepository.ts
│   │   │   └── services/
│   │   │       └── invitationRules.ts
│   │   ├── matching/
│   │   │   ├── domain/
│   │   │   │   ├── matching.ts
│   │   │   │   └── weights.ts
│   │   │   ├── repositories/
│   │   │   │   └── matchingRepository.ts
│   │   │   └── services/
│   │   │       └── matchingService.ts
│   │   ├── notifications/
│   │   │   └── repositories/
│   │   │       └── notificationRepository.ts
│   │   ├── profile/
│   │   │   ├── components/
│   │   │   │   └── ProfileForm.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useLearningProfile.ts
│   │   │   └── repositories/
│   │   │       └── profileRepository.ts
│   │   ├── progress/
│   │   │   └── services/
│   │   │       └── progress.ts
│   │   ├── scheduling/
│   │   │   ├── domain/
│   │   │   │   └── session.ts
│   │   │   └── repositories/
│   │   │       └── sessionRepository.ts
│   │   ├── study-room/
│   │   │   ├── domain/
│   │   │   │   └── timer.ts
│   │   │   ├── hooks/
│   │   │   │   └── usePomodoro.ts
│   │   │   └── repositories/
│   │   │       └── roomRepository.ts
│   │   └── subjects/
│   │       └── repositories/
│   │           └── catalogRepository.ts
│   ├── lib/
│   │   ├── config/
│   │   │   └── env.ts
│   │   ├── supabase/
│   │   │   ├── auth.ts
│   │   │   ├── client.ts
│   │   │   └── storage.ts
│   │   └── utils/
│   │       └── errors.ts
│   ├── styles/
│   │   └── index.css
│   ├── types/
│   │   └── domain.ts
│   ├── main.tsx
│   └── vite-env.d.ts
├── supabase/
│   ├── migrations/
│   │   └── 202611040001_foundation.sql
│   ├── README.md
│   └── seed.sql
├── tests/
│   ├── config/
│   │   └── environment.test.ts
│   ├── database/
│   │   └── security.test.ts
│   ├── invitations/
│   │   └── rules.test.ts
│   ├── matching/
│   │   └── matching.test.ts
│   ├── progress/
│   │   └── progress.test.ts
│   ├── scheduling/
│   │   └── session.test.ts
│   └── study-room/
│       └── timer.test.ts
├── .env.example
├── .gitignore
├── index.html
├── package-lock.json
├── package.json
├── README.md
├── tsconfig.json
├── vercel.json
├── vite.config.ts
└── vitest.config.ts
```
