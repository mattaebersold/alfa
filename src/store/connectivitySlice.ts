import { createSlice } from '@reduxjs/toolkit';

/**
 * Whether the *device* has a network at all.
 *
 * This deliberately no longer means "can we reach the ORS API". That version
 * put a full-screen "unable to connect" over the app whenever a single request
 * failed — and requests fail for reasons that have nothing to do with the
 * member's signal: the app being suspended mid-flight and its sockets torn
 * down, a slow endpoint timing out, a deploy restarting the server. Coming back
 * from another app reliably produced the screen on a phone that was perfectly
 * online.
 *
 * So a failed request is only a *hint* now. It bumps `failureTick`, and the
 * overlay answers that by probing several public hosts; the screen appears only
 * if none of them can be reached, which is the case the screen is actually for
 * — no bars, aeroplane mode, satellite/SOS.
 */
interface ConnectivityState {
  online: boolean;
  /**
   * Bumped whenever a request fails in a way that *might* mean the network is
   * gone. Watched rather than acted on: it's a prompt to go and check, not a
   * verdict.
   */
  failureTick: number;
  /**
   * The user chose to carry on without a connection. Cleared the moment the
   * connection comes back, so the next outage is announced again rather than
   * staying silent for the rest of the session.
   */
  dismissed: boolean;
}

const initialState: ConnectivityState = {
  // Assumed good until a probe says otherwise — showing "unable to connect"
  // before anything has actually been checked would accuse the network of a
  // fault it may not have.
  online: true,
  failureTick: 0,
  dismissed: false,
};

const connectivitySlice = createSlice({
  name: 'connectivity',
  initialState,
  reducers: {
    networkErrorSeen(state) {
      state.failureTick += 1;
    },
    connectionLost(state) {
      state.online = false;
    },
    connectionRestored(state) {
      state.online = true;
      state.dismissed = false;
    },
    offlineNoticeDismissed(state) {
      state.dismissed = true;
    },
  },
});

export const {
  networkErrorSeen, connectionLost, connectionRestored, offlineNoticeDismissed,
} = connectivitySlice.actions;
export default connectivitySlice.reducer;
