/**
 * The app's corner radius.
 *
 * Buttons and cards had drifted across a dozen values — 8, 10, 12, 14, 16, 20
 * and a lot of 999 pills — often two of them side by side in the same row,
 * which is the kind of thing you feel before you can name it. One number now,
 * imported rather than typed, so the next component can't invent a thirteenth.
 *
 * This is for rectangles with softened corners. Things that are *meant* to be
 * round — avatars, circular icon buttons, the odd chip — keep their own radius;
 * they're not a rectangle with a corner, they're a circle, and half their own
 * height is the only value that works.
 */
export const COMMON_RADIUS = 10;

/**
 * A fully rounded end, for a shape whose height decides its curve.
 *
 * Use it where the pill *is* the design — a circular avatar ring, a dot badge —
 * not merely to soften a button.
 */
export const PILL_RADIUS = 999;
