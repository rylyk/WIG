import { Plus } from "lucide-react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { AdminEntry } from "./pages/AdminEntry";
import { CreatePage } from "./pages/CreatePage";
import { CreatedPage } from "./pages/CreatedPage";
import { EventPage } from "./pages/EventPage";
import { NotFound } from "./pages/NotFound";

function Logo() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <rect x="7" y="7" width="8" height="8" rx="2" fill="var(--avail)" />
      <rect x="17" y="17" width="8" height="8" rx="2" fill="var(--avail)" />
      <rect x="17" y="7" width="8" height="8" rx="2" fill="var(--avail)" opacity=".45" />
      <rect x="7" y="17" width="8" height="8" rx="2" fill="var(--avail)" opacity=".2" />
    </svg>
  );
}

export function App() {
  const { pathname } = useLocation();
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <Logo />
          <span>wig</span>
          <span className="brand-sub">when is good?</span>
        </Link>
        {pathname !== "/" && (
          <Link to="/" className="btn btn-ghost btn-sm">
            <Plus size={16} /> New event
          </Link>
        )}
      </header>
      <main>
        <Routes>
          <Route path="/" element={<CreatePage />} />
          <Route path="/e/:id" element={<EventPage />} />
          <Route path="/e/:id/created" element={<CreatedPage />} />
          <Route path="/e/:id/admin" element={<AdminEntry />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
