# Mobile App + Admin Dashboard

This workspace now contains two editable projects with the same dark theme style:

- `mobile/` -> React Native (Expo) user app
- `admin/` -> React + Vite admin panel

## User Flow (Mobile)
Login/Register -> Dashboard -> Plans -> Consent -> Payment -> Status -> Withdraw -> History

## Admin Flow (Web)
Admin Login -> Dashboard -> Pending Investments -> Approve/Reject -> Add Profit -> Stats

## Run Mobile
```bash
cd mobile
npm install
npm run start
```

## Run Admin
```bash
cd admin
npm install
npm run dev
```

## Theme Edits
- Mobile colors: `mobile/src/theme.js`
- Admin styles: `admin/src/styles.css`

## API Integration
- Mobile APIs: `mobile/src/api.js`
- Admin APIs: `admin/src/api.js`

Update base URL and endpoint payload mapping based on your backend contract.
