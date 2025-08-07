import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import UpgradePromotionModal from './UpgradePromotionModal';
import {
  AppLayout as CloudscapeAppLayout,
  SideNavigation,
  TopNavigation,
  Button,
  Box,
  SpaceBetween
} from '@cloudscape-design/components';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const navigationItems = [
    {
      type: 'section' as const,
      text: 'Analysis',
      items: [
        {
          type: 'link' as const,
          text: 'Dashboard',
          href: '/dashboard',
          info: 'Overview and statistics'
        },
        {
          type: 'link' as const,
          text: 'New Analysis',
          href: '/analyze',
          info: 'Upload and analyze images'
        },
        {
          type: 'link' as const,
          text: 'History',
          href: '/history',
          info: 'View past analyses'
        }
      ]
    },
    {
      type: 'section' as const,
      text: 'Account',
      items: [
        {
          type: 'link' as const,
          text: 'Profile',
          href: '/profile',
          info: 'Manage account settings'
        }
      ]
    }
  ];

  const handleNavigate = (event: any) => {
    if (event.detail.href) {
      navigate(event.detail.href);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = user?.isAnonymous ? [
    {
      id: 'upgrade',
      text: 'Upgrade Account ⭐',
      description: 'Create permanent account'
    },
    {
      id: 'profile',
      text: 'Profile',
      href: '/profile'
    },
    {
      id: 'logout',
      text: 'Restart Session'
    }
  ] : [
    {
      id: 'profile',
      text: 'Profile',
      href: '/profile'
    },
    {
      id: 'settings',
      text: 'Settings',
      href: '/settings'
    },
    {
      id: 'logout',
      text: 'Sign Out'
    }
  ];

  const { triggerUpgradePromotion } = useAuth();

  const handleUserMenuClick = (event: any) => {
    const { id } = event.detail;
    if (id === 'logout') {
      handleLogout();
    } else if (id === 'profile') {
      navigate('/profile');
    } else if (id === 'settings') {
      navigate('/settings');
    } else if (id === 'upgrade') {
      triggerUpgradePromotion();
    }
  };

  const tools = (
    <Box padding="l">
      <SpaceBetween direction="vertical" size="l">
        <div>
          <Box variant="h3" margin={{ bottom: 's' }}>
            Quick Actions
          </Box>
          <SpaceBetween direction="vertical" size="s">
            <Button
              variant="primary"
              iconName="add-plus"
              onClick={() => navigate('/analyze')}
              fullWidth
            >
              New Analysis
            </Button>
            <Button
              variant="normal"
              iconName="file"
              onClick={() => navigate('/history')}
              fullWidth
            >
              View History
            </Button>
          </SpaceBetween>
        </div>
        
        <div>
          <Box variant="h3" margin={{ bottom: 's' }}>
            Help & Support
          </Box>
          <SpaceBetween direction="vertical" size="s">
            <Button
              variant="link"
              iconName="status-info"
              onClick={() => setToolsOpen(false)}
            >
              User Guide
            </Button>
            <Button
              variant="link"
              iconName="contact"
              onClick={() => setToolsOpen(false)}
            >
              Contact Support
            </Button>
          </SpaceBetween>
        </div>
      </SpaceBetween>
    </Box>
  );

  return (
    <>
      {/* Upgrade Promotion Modal */}
      <UpgradePromotionModal />
      
      <TopNavigation
        identity={{
          href: '/dashboard',
          title: 'Mitotic Figure Detection',
          logo: {
            src: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTkuNjYzIDE3aDQuNjczTTEyIDN2MW02LjM2NCAxLjYzNmwtLjcwNy43MDdNMjEgMTJoLTFNNCAxMkgzbTMuMzQzLTUuNjU3bC0uNzA3LS7MDdtMi44MjggOS45YTUgNSAwIDExNy4wNzIgMGwtLjU0OC41NDdBMy4zNzQgMy4zNzQgMCAwMDE0IDE4LjQ2OVYxOWEyIDIgMCAxMS00IDB2LS41MzFjMC0uODk1LS4zNTYtMS43NTQtLjk4OC0yLjM4NmwtLjU0OC0uNTQ3eiIgc3Ryb2tlPSIjNjM2NiNGMSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+',
            alt: 'Mitotic Detection Logo'
          }
        }}
        utilities={[
          {
            type: 'button',
            text: 'Documentation',
            href: '#',
            external: true,
            iconName: 'external'
          },
          {
            type: 'menu-dropdown',
            text: user?.isAnonymous 
              ? `${user?.name || 'User'} (Guest)` 
              : user?.name || 'User',
            description: user?.isAnonymous 
              ? 'Temporary account - Upgrade your account' 
              : user?.email || '',
            iconName: 'user-profile',
            items: userMenuItems,
            onItemClick: handleUserMenuClick
          }
        ]}
        i18nStrings={{
          searchIconAriaLabel: 'Search',
          searchDismissIconAriaLabel: 'Close search',
          overflowMenuTriggerText: 'More',
          overflowMenuTitleText: 'All'
        }}
      />
      
      <CloudscapeAppLayout
        navigationOpen={navigationOpen}
        onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
        toolsOpen={toolsOpen}
        onToolsChange={({ detail }) => setToolsOpen(detail.open)}
        navigationWidth={240}
        toolsWidth={280}
        navigation={
          <SideNavigation
            activeHref={location.pathname}
            header={{ text: 'Navigation', href: '/dashboard' }}
            items={navigationItems}
            onFollow={handleNavigate}
          />
        }
        tools={tools}
        content={children}
        toolsHide={false}
        navigationHide={false}
        splitPanelOpen={false}
        splitPanelSize={300}
        onSplitPanelToggle={() => {}}
        onSplitPanelResize={() => {}}
      />
    </>
  );
};

export default AppLayout; 