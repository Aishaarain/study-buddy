import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '◉' },
  { to: '/upload', label: 'Upload', icon: '↑' },
  { to: '/chat', label: 'Ask AI', icon: '💬' },
  { to: '/quiz', label: 'Quiz', icon: '✓' },
  { to: '/flashcards', label: 'Flashcards', icon: '⟳' },
  { to: '/planner', label: 'Planner', icon: '📅' },
];

export default function Sidebar() {
  const navigate = useNavigate();

  // screenshot sidebar is collapsed
  const [collapsed, setCollapsed] = useState(true);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('documentId');
    navigate('/');
  };

  return (
    <aside
      className={`h-screen shrink-0 border-r border-violet-400/15 bg-[#07061b] transition-all duration-300 ${
        collapsed ? 'w-[60px]' : 'w-56'
      } flex flex-col`}
    >
      {/* Top Logo / Collapse */}
      <div
        className={`flex h-14 items-center border-b border-violet-400/10 ${
          collapsed ? 'justify-center' : 'justify-between px-4'
        }`}
      >
        {!collapsed && (
          <span className="font-orbitron text-sm font-black tracking-[0.25em] text-white">
            STUDY<span className="text-violet-400">AI</span>
          </span>
        )}

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="grid h-8 w-8 place-items-center rounded-lg text-violet-300 transition hover:bg-violet-500/10 hover:text-white"
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-3 px-[6px] py-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={collapsed ? item.label : ''}
            className={({ isActive }) =>
              `flex h-12 items-center rounded-xl text-sm font-medium transition-all duration-200 ${
                collapsed ? 'justify-center px-0' : 'gap-3 px-3'
              } ${
                isActive
                  ? 'bg-violet-500/25 text-violet-100 shadow-[0_0_18px_rgba(139,92,246,0.12)]'
                  : 'text-slate-400 hover:bg-violet-500/10 hover:text-slate-100'
              }`
            }
          >
            <span className="grid h-6 w-6 place-items-center text-lg leading-none">
              {item.icon}
            </span>

            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t border-violet-400/10 px-[6px] py-4">
        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : ''}
          className={`flex h-12 w-full items-center rounded-xl text-sm font-medium text-red-400 transition hover:bg-red-500/10 ${
            collapsed ? 'justify-center px-0' : 'gap-3 px-3'
          }`}
        >
          <span className="text-lg leading-none">⏻</span>
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}