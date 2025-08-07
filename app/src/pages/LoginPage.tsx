import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  FormField,
  Input,
  Container,
  Header,
  SpaceBetween,
  Alert,

} from '@cloudscape-design/components';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { signInWithEmail } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email || !password) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    try {
      const success = await signInWithEmail(email, password);
      if (success) {
        navigate('/dashboard');
      } else {
        setError('Invalid credentials. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Container>
        <Box margin="xl" padding="xl">
          <div className="max-w-md mx-auto">
            <SpaceBetween direction="vertical" size="l">
              {/* Logo and Header */}
              <Box textAlign="center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <Header variant="h1" description="Sign in to your account">
                  Mitotic Figure Detection
                </Header>
              </Box>

              {/* Error Alert */}
              {error && (
                <Alert type="error" dismissible onDismiss={() => setError('')}>
                  {error}
                </Alert>
              )}

              {/* Demo Info */}
              <Alert type="info" header="Demo Authentication">
                Enter any email address and a password with at least 6 characters to continue.
              </Alert>

              {/* Login Form */}
              <form onSubmit={handleSubmit}>
                <SpaceBetween direction="vertical" size="m">
                  <FormField label="Email address" stretch>
                    <Input
                      type="email"
                      value={email}
                      onChange={({ detail }) => setEmail(detail.value)}
                      placeholder="Enter your email"
                      disabled={isLoading}
                    />
                  </FormField>

                  <FormField label="Password" stretch>
                    <Input
                      type="password"
                      value={password}
                      onChange={({ detail }) => setPassword(detail.value)}
                      placeholder="Enter your password"
                      disabled={isLoading}
                    />
                  </FormField>

                  <Button
                    variant="primary"
                    formAction="submit"
                    loading={isLoading}
                    fullWidth
                  >
                    Sign In
                  </Button>
                </SpaceBetween>
              </form>

              {/* Footer */}
              <Box textAlign="center">
                <div className="text-sm text-gray-600">
                  AI-Powered Cancer Cell Detection Platform
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  For research and educational purposes only
                </div>
              </Box>
            </SpaceBetween>
          </div>
        </Box>
      </Container>
    </div>
  );
};

export default LoginPage; 