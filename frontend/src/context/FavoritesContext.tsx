import React, { createContext, useContext, useState, useEffect } from 'react';
import { Favorite, AgriculturalLand } from '../types/index.js';
import { useAuth } from './AuthContext.js';

interface FavoritesContextType {
  favorites: Favorite[];
  isFavorite: (landId: string) => boolean;
  toggleFavorite: (landId: string) => Promise<void>;
  isLoading: boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFavorites = async () => {
    if (!user) {
      setFavorites([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/favorites', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setFavorites(data);
      }
    } catch (err) {
      console.error('Failed to fetch favorites:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, [user]);

  const isFavorite = (landId: string) => {
    return favorites.some(f => f.landId === landId);
  };

  const toggleFavorite = async (landId: string) => {
    if (!user) return;
    const exists = isFavorite(landId);
    if (exists) {
      // Optimistic update
      setFavorites(prev => prev.filter(f => f.landId !== landId));
      try {
        await fetch(`/api/favorites/${landId}`, {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      } catch (e) {
        fetchFavorites();
      }
    } else {
      try {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ landId }),
        });
        if (res.ok) {
          const newFav = await res.json();
          setFavorites(prev => [...prev, newFav]);
        }
      } catch (e) {
        console.error('Failed to add favorite:', e);
      }
    }
  };

  return (
    <FavoritesContext.Provider value={{ favorites, isFavorite, toggleFavorite, isLoading }}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
};
