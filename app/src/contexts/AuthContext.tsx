import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

interface User {
  id: string;
  email?: string;
  name: string;
  role: string;
  lastLogin: Date;
  totalAnalyses: number;
  isAnonymous: boolean;
  supabaseUser?: SupabaseUser;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signInAnonymously: () => Promise<boolean>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<boolean>;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  upgradeToEmailAuth: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
  showUpgradePromotion: boolean;
  dismissUpgradePromotion: () => void;
  triggerUpgradePromotion: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpgradePromotion, setShowUpgradePromotion] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        handleUserSession(session.user);
      } else {
        // Auto sign-in anonymously if no session
        signInAnonymouslyOnLoad();
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session);
      setSession(session);
      
      if (session?.user) {
        handleUserSession(session.user);
      } else {
        setUser(null);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check for upgrade promotion after anonymous user has used the app
  useEffect(() => {
    if (user?.isAnonymous) {
      const analysisCount = JSON.parse(localStorage.getItem('analysisHistory') || '[]').length;
      const lastPromotionDismissed = localStorage.getItem('upgradePromotionDismissed');
      const daysSinceLastDismissal = lastPromotionDismissed 
        ? (Date.now() - parseInt(lastPromotionDismissed)) / (1000 * 60 * 60 * 24)
        : Infinity;

      // Show promotion if user has done 2+ analyses and hasn't dismissed in last 3 days
      if (analysisCount >= 2 && daysSinceLastDismissal > 3) {
        setShowUpgradePromotion(true);
      }
    }
  }, [user]);

  const handleUserSession = (supabaseUser: SupabaseUser) => {
    const isAnonymous = supabaseUser.is_anonymous || false;
    
    const userData: User = {
      id: supabaseUser.id,
      email: supabaseUser.email || undefined,
      name: supabaseUser.user_metadata?.name || 
            (isAnonymous ? 'Guest User' : supabaseUser.email?.split('@')[0] || 'User'),
      role: isAnonymous ? 'Anonymous User' : 'Researcher',
      lastLogin: new Date(),
      totalAnalyses: 0,
      isAnonymous,
      supabaseUser
    };

    setUser(userData);
    setLoading(false);
  };

  const signInAnonymouslyOnLoad = async () => {
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error('Anonymous sign in error:', error);
        setLoading(false);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Anonymous sign in error:', error);
      setLoading(false);
      return false;
    }
  };

  const signInAnonymously = async (): Promise<boolean> => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error('Anonymous sign in error:', error);
        setLoading(false);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Anonymous sign in error:', error);
      setLoading(false);
      return false;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name
          }
        }
      });

      if (error) {
        console.error('Sign up error:', error);
        setLoading(false);
        return false;
      }

      // If email confirmation is required, show message
      if (data.user && !data.session) {
        console.log('Please check your email for confirmation link');
      }

      setLoading(false);
      return true;
    } catch (error) {
      console.error('Sign up error:', error);
      setLoading(false);
      return false;
    }
  };

  const signInWithEmail = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('Sign in error:', error);
        setLoading(false);
        return false;
      }

      setLoading(false);
      return true;
    } catch (error) {
      console.error('Sign in error:', error);
      setLoading(false);
      return false;
    }
  };

  const upgradeToEmailAuth = async (email: string, password: string, name: string): Promise<boolean> => {
    if (!user?.isAnonymous) {
      return false;
    }

    setLoading(true);
    try {
      // Create new email account
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name
          }
        }
      });

      if (error) {
        console.error('Upgrade error:', error);
        setLoading(false);
        return false;
      }

      // Transfer analysis history if successful
      if (data.user) {
        const analysisHistory = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
        // Update user IDs in analysis history
        const updatedHistory = analysisHistory.map((analysis: any) => ({
          ...analysis,
          userId: data.user!.id
        }));
        localStorage.setItem('analysisHistory', JSON.stringify(updatedHistory));
      }

      setShowUpgradePromotion(false);
      setLoading(false);
      return true;
    } catch (error) {
      console.error('Upgrade error:', error);
      setLoading(false);
      return false;
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
      }
      
      // Clear local storage
      localStorage.removeItem('analysisHistory');
      
      // Sign in anonymously again
      await signInAnonymously();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const dismissUpgradePromotion = () => {
    setShowUpgradePromotion(false);
    localStorage.setItem('upgradePromotionDismissed', Date.now().toString());
  };

  const triggerUpgradePromotion = () => {
    setShowUpgradePromotion(true);
  };

  const value: AuthContextType = {
    user,
    session,
    signInAnonymously,
    signUpWithEmail,
    signInWithEmail,
    upgradeToEmailAuth,
    logout,
    isAuthenticated: !!user,
    loading,
    showUpgradePromotion,
    dismissUpgradePromotion,
    triggerUpgradePromotion
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 