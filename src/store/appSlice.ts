import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type AppStatus = 'idle' | 'uploading' | 'processing' | 'ready' | 'error';

interface AppState {
  status: AppStatus;
  currentDocumentId: string | null;
  errorMessage: string | null;
}

const initialState: AppState = {
  status: 'idle',
  currentDocumentId: null,
  errorMessage: null,
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setStatus(state, action: PayloadAction<AppStatus>) {
      state.status = action.payload;
      if (action.payload !== 'error') state.errorMessage = null;
    },
    setCurrentDocumentId(state, action: PayloadAction<string>) {
      state.currentDocumentId = action.payload;
    },
    setError(state, action: PayloadAction<string>) {
      state.status = 'error';
      state.errorMessage = action.payload;
    },
    resetApp(state) {
      state.status = 'idle';
      state.currentDocumentId = null;
      state.errorMessage = null;
    },
  },
});

export const { setStatus, setCurrentDocumentId, setError, resetApp } = appSlice.actions;
export default appSlice.reducer;