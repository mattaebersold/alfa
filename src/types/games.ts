/**
 * The PRO tab's Daily Games, ported from the standalone Car Spotter app: the
 * car (name it from a close-up of its photo) and the auction (guess what a
 * finished auction sold for). horacio's `/api/carspot/...` endpoints — see
 * its carSpotController and spotGamesController.
 *
 * Named apart from types/api's CarSpot* types, which are the feed's narrower
 * reading of the same plays (SpotResultBody).
 */

/** The two daily games. Trivia was retired with Car Spotter. */
export type DailyGameKind = 'car' | 'auction';

export const MAX_ATTEMPTS = 5;

/** A member as the game endpoints send them — enough for an avatar and a name. */
export interface GameUserLite {
  user_id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  gallery?: { filename?: string }[];
  profilePicture?: string;
  avatarColor?: string;
  accountType?: string;
}

// ── The car ──────────────────────────────────────────────────────────────────

export interface CarGuess {
  make: string;
  model: string;
  make_correct: boolean;
  model_correct: boolean;
  at?: string;
}

/** Who took a puzzle's photo, when it wasn't ours — a Commons or Unsplash photographer. */
export interface CarPhotoCredit {
  source: string;
  author?: string;
  license?: string;
  url?: string;
}

export interface CarAnswer {
  make: string;
  model: string;
  year?: string | null;
  photo_credit?: CarPhotoCredit;
}

/** A day's car as the server shows it to players — never the answer. */
export interface CarPuzzle {
  internal_id: string;
  puzzle_number: number;
  play_date: string;
  image: string;
  focus_x: number;
  focus_y: number;
  zoom: number;
  /** Whether there's a hint to ask for. The text itself comes with the play, once used. */
  has_hint?: boolean;
  hint?: string | null;
}

export type CarStatus = 'playing' | 'won' | 'lost';

/**
 * How a game is drawn. Every new game is `zoom` (no picker); the others are
 * kept so a game started in one in Car Spotter still plays out in it.
 */
export type CarMode = 'zoom' | 'blur' | 'scattered' | 'pixelated';

export interface CarPlay {
  internal_id: string;
  status: CarStatus;
  attempts: number;
  max_attempts: number;
  guesses: CarGuess[];
  make_solved: boolean;
  model_solved: boolean;
  /** Begun after its day — played in full, but left out of stats. */
  late?: boolean;
  mode?: CarMode;
  /** How long the game took, ms, from the photo first showing. */
  time_ms?: number | null;
  hint_used?: boolean;
  /** The hint's text — once used, or once the game's over. */
  hint?: string | null;
  /** Only once the game is over. */
  answer?: CarAnswer;
  play_date?: string;
  puzzle_number?: number;
  finished_at?: string;
}

/** Whose garage car the puzzle is — sent only once your game is over. */
export interface CarCredit {
  kind: 'member';
  user: GameUserLite;
  garage_car_id: string | null;
}

/** GET api/carspot/today. `puzzle` is null when nothing is scheduled. */
export interface CarToday {
  puzzle: CarPuzzle | null;
  play: CarPlay | null;
  credit?: CarCredit | null;
  /** The next day boundary, ISO. */
  next_at: string;
}

/** One puzzle day in the log: the puzzle, my play of it (or none), and the answer once it's over. */
export interface CarDay {
  play_date: string;
  puzzle_number: number;
  puzzle: CarPuzzle;
  play: CarPlay | null;
  answer?: CarAnswer;
  credit?: CarCredit | null;
}

export interface CarDaysPage {
  days: CarDay[];
  total: number;
  /** The server's day key for today. */
  today: string;
}

export interface CarStats {
  played: number;
  won: number;
  win_rate: number;
  current_streak: number;
  max_streak: number;
  /** Wins by attempt count, keyed '1'..'5'. Losses are `played - won`. */
  distribution: Record<string, number>;
  average_attempts?: number;
  hints_used?: number;
}

export interface CarLeaderboardEntry {
  user: GameUserLite;
  played: number;
  won: number;
  /** Percent, one decimal. */
  win_rate: number;
  hints?: number;
  avg_ms: number | null;
  best_ms: number | null;
}

export interface CarLeaderboard {
  sort: 'best' | 'fastest';
  entries: CarLeaderboardEntry[];
  /** This week's board: the Monday it started, and when it starts over. */
  week_start?: string;
  resets_at?: string;
}

/** The history endpoint's page; only its stats are read (getCarGameStats). */
export interface CarHistoryPage {
  total: number;
  stats: CarStats;
}

// ── The auction ──────────────────────────────────────────────────────────────

export interface AuctionFact {
  /** "Mileage", "Location"… — or null for a line of the listing's own. */
  label: string | null;
  value: string;
}

export interface AuctionPuzzle {
  internal_id: string;
  puzzle_number: number;
  play_date: string;
  title: string;
  subtitle: string | null;
  /** S3 filenames; the first is the cover. */
  images: string[];
  facts: AuctionFact[];
  /** 'YYYY-MM-DD' the auction ended. */
  ended_on: string | null;
  source: 'bat' | 'carsandbids' | 'other';
  /** False: bid to the price, no sale (reserve not met). */
  sold?: boolean;
}

export interface AuctionAnswer {
  price: number;
  sold: boolean;
  url: string | null;
}

export interface AuctionPlay {
  internal_id: string;
  game: 'auction';
  play_date: string;
  puzzle_number: number;
  late: boolean;
  time_ms: number | null;
  status: 'done';
  guess: number;
  /** 0–100: how close. */
  score: number;
  /** Signed: -9.5 is 9.5% under. */
  off_pct?: number;
  /** Within 5%. */
  bullseye?: boolean;
  answer?: AuctionAnswer;
}

export interface AuctionToday {
  puzzle: AuctionPuzzle | null;
  play: AuctionPlay | null;
  next_at: string;
}

export interface AuctionDay {
  play_date: string;
  puzzle_number: number;
  puzzle: AuctionPuzzle;
  play: AuctionPlay | null;
}

export interface AuctionDaysPage {
  days: AuctionDay[];
  total: number;
  today: string;
}

export interface AuctionStats {
  game: 'auction';
  played: number;
  average_score: number;
  best_score: number;
  bullseyes: number;
  /** Days played in a row. */
  current_streak: number;
  max_streak: number;
}

export interface AuctionLeaderboardEntry {
  user: GameUserLite;
  played: number;
  average_score?: number;
  best_score?: number;
  avg_ms: number | null;
}

export interface AuctionLeaderboard {
  game: 'auction';
  entries: AuctionLeaderboardEntry[];
  week_start?: string;
  resets_at?: string;
}
