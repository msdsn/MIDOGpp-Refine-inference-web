import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Tables } from '../types/database.types';
import { useAuth } from './AuthContext';

type ImageRow = Tables<'images'>;

interface ImagesContextType {
  images: ImageRow[];
  loading: boolean;
}

const ImagesContext = createContext<ImagesContextType | undefined>(undefined);

export const ImagesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [images, setImages] = useState<ImageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    let isMounted = true;

    const fetchInitial = async () => {
      if (!user?.id) return;
      // Fetch both user images and test images
      const { data, error } = await supabase
        .from('images')
        .select('*')
        .or(`profile_id.eq.${user.id},is_test_image.eq.true`)
        .order('created_at', { ascending: false });
      if (!isMounted) return;
      if (error) {
        console.error('Images fetch error:', error.message);
      } else if (data) {
        setImages(data as ImageRow[]);
      }
      setLoading(false);
    };

    fetchInitial();

    const channel = user?.id
      ? supabase
          .channel('realtime:images')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'images', filter: `profile_id=eq.${user.id}` },
            payload => {
              setImages(prev => [payload.new as ImageRow, ...prev]);
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'images', filter: `profile_id=eq.${user.id}` },
            payload => {
              setImages(prev => prev.map(img => (img.id === (payload.new as ImageRow).id ? (payload.new as ImageRow) : img)));
            }
          )
          .on(
            'postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'images', filter: `profile_id=eq.${user.id}` },
            payload => {
              setImages(prev => prev.filter(img => img.id !== (payload.old as ImageRow).id));
            }
          )
          .subscribe()
      : null;

    return () => {
      isMounted = false;
      channel?.unsubscribe();
    };
  }, [user?.id]);

  const value = useMemo<ImagesContextType>(() => ({ images, loading }), [images, loading]);

  return <ImagesContext.Provider value={value}>{children}</ImagesContext.Provider>;
};

export const useImages = () => {
  const ctx = useContext(ImagesContext);
  if (!ctx) throw new Error('useImages must be used within ImagesProvider');
  return ctx;
};


