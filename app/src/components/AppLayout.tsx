import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import UpgradePromotionModal from './UpgradePromotionModal';
import Footer from './Footer';
import Intercom, { show, shutdown, hide, onHide, onShow } from '@intercom/messenger-js-sdk';
import {
  AppLayout as CloudscapeAppLayout,
  SideNavigation,
  TopNavigation,
  Button
} from '@cloudscape-design/components';
import './AppLayout.css';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [intercomVisible, setIntercomVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  // Check if mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    Intercom({
      app_id: 'kvdugt16',
      hide_default_launcher: true,     // default launcher'ı gizle
      alignment: 'right',              
      horizontal_padding: 0,
      vertical_padding: 20,
    });

    // Mobile'da başlangıçta kapalı, desktop'ta açık
    if (isMobile) {
      hide();
      setIntercomVisible(false);
    } else {
      show();
      setIntercomVisible(true);
    }

    // Intercom show/hide event listeners
    onShow(() => {
      setIntercomVisible(true);
    });

    onHide(() => {
      setIntercomVisible(false);
    });

    return () => {
      shutdown();
    };
  }, [isMobile]);

  const navigationItems = [
    {
      type: 'section' as const,
      text: 'Analysis',
      items: [
        {
          type: 'link' as const,
          text: 'Dashboard',
          href: '#',
          info: 'Overview and statistics',
          data: { route: '/dashboard' }
        },
        {
          type: 'link' as const,
          text: 'New Analysis',
          href: '#',
          info: 'Upload and analyze images',
          data: { route: '/analyze' }
        },
        {
          type: 'link' as const,
          text: 'History',
          href: '#',
          info: 'View past analyses',
          data: { route: '/history' }
        },
      ]
    },
    {
      type: 'section' as const,
      text: 'Account',
      items: [
        {
          type: 'link' as const,
          text: 'Profile',
          href: '#',
          info: 'Manage account settings',
          data: { route: '/profile' }
        }
      ]
    }
  ];

  const handleNavigate = (event: any) => {
    event.preventDefault(); // Sayfa yenilenmesini engelle
    
    // Custom data attribute'dan route bilgisini al
    const route = event.detail.data?.route || event.detail.href;
    
    if (route && route !== '#') {
      navigate(route);
    }
  };

  const handleChatToggle = () => {
    if (intercomVisible) {
      hide();
    } else {
      show();
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

  // Content genişliği hesaplama: Intercom açıkken 400px boşluk bırak
  const contentWidth = intercomVisible ? 'calc(100% - 400px)' : 'calc(100% - 40px)';

  return (
    <>
      {/* Upgrade Promotion Modal */}
      <UpgradePromotionModal />
      
      <TopNavigation
        identity={{
          href: '',
          title: 'PathoMito',
          onFollow: () => navigate('/dashboard')
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
        navigationWidth={240}
        navigation={
          <SideNavigation
            activeHref={location.pathname}
            header={{ 
              text: 'Navigation', 
              href: '#'
            }}
            items={navigationItems}
            onFollow={handleNavigate}
          />
        }
        content={
          <div style={{ width: '100%', position: 'relative' }}>
            <div style={{ width: contentWidth, position: 'relative' }}>
            {children}
            <Footer />
            </div>
            
            
            {/* Chat Button - Intercom gizliyken göster */}
            {!intercomVisible && (
              <div className="chat-button">
                <Button
                  variant="primary"
                  iconName="contact"
                  onClick={handleChatToggle}
                  ariaLabel="Open chat support"
                />
              </div>
            )}
          </div>
        }
        toolsHide={true}
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