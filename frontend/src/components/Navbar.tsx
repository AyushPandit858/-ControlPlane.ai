import React from 'react';
import { ShieldCheck, Activity, UserCheck, Sliders, Database, Zap } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingReviewsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  pendingReviewsCount,
}) => {
  const navItems = [
    { id: 'playground', label: 'Live Inspector', icon: ShieldCheck },
    { id: 'reviews', label: 'HITL Review Queue', icon: UserCheck, badge: pendingReviewsCount },
    { id: 'analytics', label: 'Executive Analytics', icon: Activity },
    { id: 'policies', label: 'Policy Engine', icon: Sliders },
    { id: 'knowledge', label: 'Ground Truth DB', icon: Database },
  ];

  return (
    <header className="app-header" style={{ 
      padding: '16px 32px', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      borderBottom: '1px solid var(--border-card)',
      background: 'var(--bg-card)'
    }}>
      {/* Brand & Tagline */}
      <div className="brand-block" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          background: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <ShieldCheck size={20} color="var(--bg-card)" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-main)' }}>ControlPlane</span>
            <span className="badge badge-low" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
              <Zap size={10} /> Active Gateway
            </span>
          </div>
          <p className="brand-tagline" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Responsible AI Guardrail & Efficiency Middleware</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="primary-nav" aria-label="ControlPlane sections" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className="nav-button"
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: isActive ? 'var(--bg-card-hover)' : 'transparent',
                color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} color={isActive ? 'var(--text-main)' : 'var(--text-dim)'} />
              <span>{item.label}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span style={{
                  background: 'var(--risk-high)',
                  color: 'white',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '12px',
                  marginLeft: '4px'
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
