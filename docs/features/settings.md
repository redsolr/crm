# Settings

> Full-page settings rendered as an overlay in the main content area.

## Architecture

Settings uses the **overlay system** — clicking Settings opens it inline (not a modal), hiding the sidebar panel and replacing the main content. The activity bar stays visible.

### State Flow

```
AccountMenu → openOverlay("settings") → useLayoutUI store
    → useOverlayRouting pushes /settings
    → AppLayout renders <SettingsContent /> in overlay slot
```

### Files

| File | Purpose |
|------|---------|
| `components/SettingsContent.tsx` | Shell: nav sidebar + active section render |
| `components/settings/primitives.tsx` | Shared UI: Toggle, OutlineButton, SectionTitle, SectionDivider, FieldLabel, SettingRow, UsageMeter, ThemeCard, CopyIcon, INPUT_CLASS |
| `components/settings/GeneralSection.tsx` | Profile, preferences, notifications, appearance |
| `components/settings/AccountSection.tsx` | Sessions, logout, delete, org ID |
| `components/settings/PrivacySection.tsx` | Privacy info + data toggle |
| `components/settings/BillingSection.tsx` | Plan info, payment, invoices, cancellation |
| `components/settings/UsageSection.tsx` | Usage meters, weekly limits, extra usage |

### API Integration

| Feature | Endpoint | Hook |
|---------|----------|------|
| Profile name | `PUT /users/:id` | `useProfileMutation` |
| Preferences (role, tone, length) | `PUT /user-preferences/me` | `usePreferencesQuery` |
| Session count | `GET /auth/sessions` | `useSessionCountQuery` |
| Revoke all sessions | `POST /auth/sessions/revoke-all` | `useSessionCountQuery` |
| Subscription | `GET /accounts/:id/subscription` | `useAccountDataQuery` |
| Usage summary | `GET /usage/summary` + `GET /billing/overview` | `useUsageDisplayQuery` |

### Adding a New Section

1. Create `components/settings/NewSection.tsx`
2. Import shared primitives from `./primitives`
3. Add entry to `SECTIONS` array in `SettingsContent.tsx`
4. The nav item and routing is automatic
