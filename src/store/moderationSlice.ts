import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ModerationState {
  hiddenContentIds: string[];
  blockedUserIds: string[];
  contentFilterEnabled: boolean;
}

const initialState: ModerationState = {
  hiddenContentIds: [],
  blockedUserIds: [],
  contentFilterEnabled: false,
};

const moderationSlice = createSlice({
  name: 'moderation',
  initialState,
  reducers: {
    hideContent: (state, action: PayloadAction<string>) => {
      if (!state.hiddenContentIds.includes(action.payload)) {
        state.hiddenContentIds.push(action.payload);
      }
    },
    setContentFilter: (state, action: PayloadAction<boolean>) => {
      state.contentFilterEnabled = action.payload;
    },
    // Replace the whole blocked-users list (synced from the server on load).
    setBlockedUsers: (state, action: PayloadAction<string[]>) => {
      state.blockedUserIds = action.payload;
    },
    // Add one immediately when the user blocks someone (instant feed hide).
    addBlockedUser: (state, action: PayloadAction<string>) => {
      if (action.payload && !state.blockedUserIds.includes(action.payload)) {
        state.blockedUserIds.push(action.payload);
      }
    },
    removeBlockedUser: (state, action: PayloadAction<string>) => {
      state.blockedUserIds = state.blockedUserIds.filter((id) => id !== action.payload);
    },
  },
});

export const { hideContent, setContentFilter, setBlockedUsers, addBlockedUser, removeBlockedUser } = moderationSlice.actions;
export default moderationSlice.reducer;
