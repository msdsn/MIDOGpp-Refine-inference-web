import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Modal,
  Box,
  SpaceBetween,
  Button,
  FormField,
  Input,
  Alert,
  Badge,
  ColumnLayout
} from '@cloudscape-design/components';

const UpgradePromotionModal: React.FC = () => {
  const { showUpgradePromotion, dismissUpgradePromotion, upgradeToEmailAuth } = useAuth();
  const [showUpgradeForm, setShowUpgradeForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUpgrade = async () => {
    if (!email || !password || !name) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const success = await upgradeToEmailAuth(email, password, name);
      if (success) {
        // Modal will close automatically as showUpgradePromotion will become false
        setShowUpgradeForm(false);
      } else {
        setError('Account upgrade failed. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    dismissUpgradePromotion();
    setShowUpgradeForm(false);
    setEmail('');
    setPassword('');
    setName('');
    setError('');
  };

  if (!showUpgradePromotion) {
    return null;
  }

  return (
    <Modal
      visible={showUpgradePromotion}
      onDismiss={handleDismiss}
      header="🚀 Upgrade Your Account to Permanent!"
      size="medium"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="s">
            <Button
              variant="link"
              onClick={handleDismiss}
            >
              Not Now
            </Button>
            {!showUpgradeForm ? (
              <Button
                variant="primary"
                onClick={() => setShowUpgradeForm(true)}
              >
                Upgrade Account
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleUpgrade}
                loading={isLoading}
                disabled={!email || !password || !name}
              >
                Create Permanent Account
              </Button>
            )}
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween direction="vertical" size="l">
        {!showUpgradeForm ? (
          <>
            <Alert type="info" header="You are currently using the app as a guest user">
              Create a permanent account to keep your data safe and access more features!
            </Alert>

            <ColumnLayout columns={2}>
              <Box>
                <Box variant="h3" margin={{ bottom: 's' }}>
                  🎯 Your Current Status
                </Box>
                <SpaceBetween direction="vertical" size="s">
                  <div className="flex items-center">
                    <Badge color="grey">Guest</Badge>
                    <span className="ml-2 text-sm">Temporary access</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    • Your analyses are deleted when you clear browser data
                  </div>
                  <div className="text-sm text-gray-600">
                    • Basic features only
                  </div>
                </SpaceBetween>
              </Box>

              <Box>
                <Box variant="h3" margin={{ bottom: 's' }}>
                  ✨ With Permanent Account
                </Box>
                <SpaceBetween direction="vertical" size="s">
                  <div className="flex items-center">
                    <Badge color="green">Permanent</Badge>
                    <span className="ml-2 text-sm">Secure access</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    • Your analyses are always safe
                  </div>
                  <div className="text-sm text-gray-600">
                    • Advanced reporting features
                  </div>
                  <div className="text-sm text-gray-600">
                    • Access from any device
                  </div>
                  <div className="text-sm text-gray-600">
                    • Analysis history backup
                  </div>
                </SpaceBetween>
              </Box>
            </ColumnLayout>
          </>
        ) : (
          <>
            <Box variant="h3">
              Create Permanent Account with Email
            </Box>

            {error && (
              <Alert type="error" dismissible onDismiss={() => setError('')}>
                {error}
              </Alert>
            )}

            <SpaceBetween direction="vertical" size="m">
              <FormField label="Your Name" stretch>
                <Input
                  value={name}
                  onChange={({ detail }) => setName(detail.value)}
                  placeholder="Enter your name"
                  disabled={isLoading}
                />
              </FormField>

              <FormField label="Email Address" stretch>
                <Input
                  type="email"
                  value={email}
                  onChange={({ detail }) => setEmail(detail.value)}
                  placeholder="Enter your email address"
                  disabled={isLoading}
                />
              </FormField>

              <FormField label="Password" stretch>
                <Input
                  type="password"
                  value={password}
                  onChange={({ detail }) => setPassword(detail.value)}
                  placeholder="Create a strong password (min. 6 characters)"
                  disabled={isLoading}
                />
              </FormField>
            </SpaceBetween>

            <Alert type="info">
              Your current analysis history will be automatically transferred to your new account.
            </Alert>
          </>
        )}
      </SpaceBetween>
    </Modal>
  );
};

export default UpgradePromotionModal; 