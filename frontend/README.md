# Inventory Management System - Frontend

A modern React-based frontend for the Inventory Management System.

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **React Router** - Navigation
- **Zustand** - State management
- **React Query** - Server state management
- **Axios** - HTTP client
- **Lucide React** - Icons

## Features

### Master Data Management
- **Dashboard** - Overview with stats and quick actions
- **Items** - Product catalog with full CRUD operations
- **Categories** - Hierarchical category tree management
- **Units** - Units of measurement with preset defaults
- **Parties** - Suppliers and customers management

### UI Features
- Modern, clean design inspired by Zoho Inventory
- Responsive sidebar navigation
- Data tables with pagination
- Modal forms for create/edit
- Slide-over detail panels
- Toast notifications
- Loading states and animations

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

### API Configuration

The frontend expects the Master Service API to be running at `http://localhost:8002`.

The Vite proxy configuration handles API routing:
- `/api/*` → `http://localhost:8002/api/*`

## Project Structure

```
src/
├── components/
│   ├── layout/         # Layout components (Sidebar, Header, Layout)
│   └── ui/             # Reusable UI components (Button, Modal, Table, etc.)
├── pages/              # Page components
│   ├── Dashboard.tsx
│   ├── Items.tsx
│   ├── Categories.tsx
│   ├── Units.tsx
│   └── Parties.tsx
├── services/           # API services
│   └── api.ts
├── store/              # Zustand stores
│   └── appStore.ts
├── types/              # TypeScript types
│   └── index.ts
├── App.tsx             # Main app with routing
├── main.tsx            # Entry point
└── index.css           # Global styles with Tailwind
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Environment Variables

Create a `.env` file for environment-specific settings:

```env
VITE_API_URL=http://localhost:8002
```

## Future Enhancements

- [ ] Authentication & authorization
- [ ] Dark mode support
- [ ] Inventory tracking pages
- [ ] Purchase orders
- [ ] Sales orders
- [ ] Reports & analytics
- [ ] Excel import/export UI
- [ ] Settings page
