import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import UpgradePromotionModal from './UpgradePromotionModal';
import Chatbot from './chatbot/Chatbot';
import {
  AppLayout as CloudscapeAppLayout,
  SideNavigation,
  TopNavigation
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
  useEffect(() => {
    //const isMobile = window.innerWidth < 600;
    //setToolsOpen(!isMobile);
  }, []);

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
        },
        {
          type: 'link' as const,
          text: 'Demo Analysis',
          href: '/demo',
          info: 'Test ImageViewer3D component'
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Chatbot />
    </div>
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
            src: '/mitoticlogo.png',
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
        toolsWidth={360}
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