import React, { forwardRef } from 'react';

import ButtonGroup from '@cloudscape-design/components/button-group';
import StatusIndicator from '@cloudscape-design/components/status-indicator';

import type { AuthorAvatarProps } from './config';

export function ChatBubbleAvatar({ type, name, initials, loading }: AuthorAvatarProps) {
  // Base styles for avatar container
  const baseStyles: React.CSSProperties = {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '600',
    flexShrink: 0,
    position: 'relative',
  };

  // Loading spinner overlay
  const loadingOverlayStyles: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  // Spinner animation
  const spinnerStyles: React.CSSProperties = {
    width: '16px',
    height: '16px',
    border: '2px solid #e0e0e0',
    borderTop: '2px solid #0073bb',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  };

  // Type-specific styling
  const getAvatarStyles = (): React.CSSProperties => {
    if (type === 'user') {
      return {
        ...baseStyles,
        backgroundColor: '#0073bb',
        color: 'white',
      };
    } else if (type === 'gen-ai') {
      return {
        ...baseStyles,
        backgroundColor: '#232f3e',
        color: 'white',
      };
    }
    return baseStyles;
  };

  // Get display text (initials or fallback)
  const getDisplayText = (): string => {
    if (initials) return initials;
    if (type === 'user') return 'U';
    if (type === 'gen-ai') return 'AI';
    return name.charAt(0).toUpperCase();
  };

  return (
    <>
      {/* CSS keyframes for spinner animation */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      
      <div 
        style={getAvatarStyles()}
        title={name}
        role="img"
        aria-label={`Avatar for ${name}`}
      >
        {getDisplayText()}
        
        {/* Loading overlay */}
        {loading && (
          <div style={loadingOverlayStyles}>
            <div style={spinnerStyles} />
          </div>
        )}
      </div>
    </>
  );
}

export function CodeViewActions({ contentToCopy }: { contentToCopy: string }) {
  return (
    <ButtonGroup
      ariaLabel="Code snippet actions"
      variant="icon"
      onItemClick={({ detail }) => {
        if (detail.id !== 'copy' || !navigator.clipboard) {
          return;
        }

        navigator.clipboard.writeText(contentToCopy).catch(error => 
          console.log('Failed to copy', error.message)
        );
      }}
      items={[
        {
          type: 'group',
          text: 'Actions',
          items: [
            {
              type: 'icon-button',
              id: 'help',
              iconName: 'status-info',
              text: 'Get help',
            },
            {
              type: 'icon-button',
              id: 'analyze',
              iconName: 'add-plus',
              text: 'Start analysis',
            },
          ],
        },
        {
          type: 'icon-button',
          id: 'copy',
          iconName: 'copy',
          text: 'Copy',
          popoverFeedback: <StatusIndicator type="success">Message copied</StatusIndicator>,
        },
      ]}
    />
  );
}

export const FittedContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <div style={{ position: 'relative', flexGrow: 1 }}>
      <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
    </div>
  );
};

export const ScrollableContainer = forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  function ScrollableContainer({ children }, ref) {
    return (
      <div style={{ position: 'relative', blockSize: '100%' }}>
        <div 
          style={{ position: 'absolute', inset: 0, overflowY: 'auto' }} 
          ref={ref} 
          data-testid="chat-scroll-container"
        >
          {children}
        </div>
      </div>
    );
  }
);


