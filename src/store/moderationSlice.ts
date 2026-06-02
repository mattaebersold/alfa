import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ModerationState {
  hiddenContentIds: string[];
  contentFilterEnabled: boolean;
}

const initialState: ModerationState = {
  hiddenContentIds: [],
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
  },
});

export const { hideContent, setContentFilter } = moderationSlice.actions;
export default moderationSlice.reducer;
