export { createRng, cyrb53 } from './rng/rng.ts';
export type { Rng, Seed } from './rng/rng.ts';

export { DELTA, DIRECTIONS, OPPOSITE, directionBetween, step } from './board/direction.ts';
export type { Direction } from './board/direction.ts';
export { head } from './board/types.ts';
export type { Arrow, Cell, Mask, Path, Puzzle, RayMode } from './board/types.ts';
export {
  activeCells,
  activeCount,
  cellIndex,
  colorAt,
  inBounds,
  isActive,
  maskFromAscii,
  maskFromPixels,
  rectangleMask,
} from './board/mask.ts';

export { partition } from './generator/partition.ts';
export type { PartitionOptions } from './generator/partition.ts';
export { peel } from './generator/peel.ts';
export type { PeelOptions, PeelResult } from './generator/peel.ts';
export { generateInBand, generatePuzzle } from './generator/generate.ts';
export type {
  GenerateInBandOptions,
  GenerateOptions,
  GeneratedPuzzle,
  TargetBand,
} from './generator/generate.ts';

export {
  clearArrow,
  createOccupancy,
  placeArrow,
  rayBlockers,
  rayCells,
  rayStatus,
} from './solver/occupancy.ts';
export type { Occupancy, RayStatus } from './solver/occupancy.ts';
export { analyze, difficultyScore } from './solver/solve.ts';
export type { Analysis } from './solver/solve.ts';

export { DEFAULT_LIVES, arrowAt, createGame, freeArrows, hint, tap } from './game/state.ts';
export type { GameOptions, GameState, GameStatus, TapOutcome, TapResult } from './game/state.ts';

export {
  PLATEAU_LEVEL,
  TIERS,
  TIER_ORDER,
  boardSizeForLevel,
  tierForLevel,
} from './levels/tiers.ts';
export type { Tier, TierParams } from './levels/tiers.ts';
export {
  generateBoard,
  generateDaily,
  generateForTier,
  generateLevel,
  weekdayOf,
} from './levels/levels.ts';
export type { BoardOptions, BoardPuzzle, DailyPuzzle, LevelPuzzle } from './levels/levels.ts';

export { BUTTERFLY, DRAWINGS, HEART, drawingMask, findDrawing } from './drawings/drawings.ts';
export type { Drawing } from './drawings/drawings.ts';

export { ADJECTIVES, NOUNS, characterNames } from './league/names.ts';
export { TIER_MULTIPLIER, parSeconds, scoreBoard } from './league/scoring.ts';
export type { BoardResult } from './league/scoring.ts';
export {
  AVATAR_COUNT,
  BRONZE_MEDIAN,
  LEAGUES,
  LEAGUE_SIZE,
  LEAGUE_STEP,
  PROMOTED,
  RELEGATED,
  SECONDS_PER_DAY,
  SKILL_SPREAD,
  characterScoreAt,
  generateSeason,
  leagueMedian,
  nextLeague,
  resolveDay,
  standings,
} from './league/league.ts';
export type {
  Character,
  DayOutcome,
  LeagueName,
  PlayerEntry,
  Row,
  Season,
  Session,
} from './league/league.ts';

export { renderAscii } from './debug/ascii.ts';
