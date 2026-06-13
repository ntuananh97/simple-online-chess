import { create } from 'zustand';
import { v4 as uuidv4 } from "uuid";

interface IUserStore {
  userId?: string;
  getUserId: () => string;
  setUserId: (userId: string) => void;
}

export const useUserStore = create<IUserStore>((set, get) => ({
  userId: undefined,
  getUserId: () => {
    const userId = get().userId;
    if (userId) return userId;

    const localUserId = localStorage.getItem('userId');
    if (localUserId) {
        set({ userId: localUserId });
        return localUserId;
    }

    const newUserId = uuidv4();
    localStorage.setItem('userId', newUserId);
    set({ userId: newUserId });
    return newUserId;
  },
  setUserId: (userId: string) => set({ userId }),
}))