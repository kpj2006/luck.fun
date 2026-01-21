// ==========================================
// UNPREDICTABLE CRASH GAME CONFIGURATION
// ==========================================
// Tick interval: 500ms per tick
// Game duration: MINIMUM 5 seconds, then random crash
// Multiplier range: 0.0x - 3.0x (truly random, no bounds)
// Crash penalty: -0.5x (lose 50% of stake if don't cash out)
// Movement: COMPLETELY RANDOM (not zigzag pattern)
// Crash timing: RANDOM after 5 seconds (unpredictable!)
// ==========================================

/**
 * Generates random crash tick (when game will crash)
 * @returns Random tick number between 11-20 (5.5s - 10s after start)
 */
export function generateCrashPoint(): number {
  // Game runs MINIMUM 10 ticks (5 seconds)
  // Then crashes randomly between tick 11-20 (5.5s to 10s)
  const minTick = 11; // Crash earliest at 5.5 seconds
  const maxTick = 20; // Crash latest at 10 seconds
  return Math.floor(Math.random() * (maxTick - minTick + 1)) + minTick;
}

/**
 * Creates UNPREDICTABLE price movement simulator
 * @param crashAtTick - Random tick number when crash happens (from generateCrashPoint)
 * @returns Function that generates completely random price ticks
 * 
 * Behavior:
 * - UNPREDICTABLE: Each tick is completely random (up OR down)
 * - NO PATTERN: Could go up 5 times in row, or down 3 times - no pattern
 * - NO BOUNDS: Can reach 0.0x (total loss) or 3.0x (triple win)
 * - RANDOM CRASH: Crashes randomly AFTER 5 seconds (tick 11-20)
 * - CRASH PENALTY: If don't cash out = lose 50% of stake (0.5x)
 * - Players know: "At least 5 seconds" but NOT when exactly it crashes!
 * 
 * Example game:
 * 1.00x → 1.15x → 0.95x → 1.30x → 1.45x → 0.80x → 1.10x → 0.65x → 1.25x → 1.40x 
 * → 1.60x → 1.35x → 💥 CRASH at 6 seconds! (random)
 */
export function createTickGenerator(crashAtTick: number) {
  let current = 1.00;
  let tickCount = 0;

  return function nextTick() {
    tickCount++;
    
    // UNPREDICTABLE RANDOM MOVEMENT
    // Each tick: -20% to +30% change (completely random)
    const randomChange = -0.20 + Math.random() * 0.50; // Range: -20% to +30%
    
    // Apply random change
    current = current * (1 + randomChange);
    
    // Allow going to 0 but not below (can't have negative multiplier)
    if (current < 0) current = 0;
    
    // Cap at 3.0x max (to prevent extreme values)
    if (current > 3.0) current = 3.0;

    // CRASH RANDOMLY AFTER 5 SECONDS (minimum tick 11, maximum tick 20)
    if (tickCount >= crashAtTick) {
      return { value: parseFloat(current.toFixed(2)), crashed: true };
    }

    return { value: parseFloat(current.toFixed(2)), crashed: false };
  };
}
