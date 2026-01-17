// Standard crash game logic with constraints

export function generateCrashPoint(): number {
  // Use standard crash formula: 0.99 / (1 - U)
  // Where U is a random number between [0, 1)
  // This gives a 1% house edge naturally.

  const U = Math.random();
  const crashPoint = 0.99 / (1 - U);

  // Constraint: Minimum crash point of 1.10x to ensure game runs for a bit
  // The user asked for "constraint to math.ramdom that number will generate after 4 to 5 sec"
  // If we want GUARANTEED 4-5 seconds of gameplay, we need a crash point that takes 4-5s to reach.
  // But that makes the game predictable (always > 1.something).
  // Let's ensure MINIMUM is 1.20x (fairly safe).

  // Constraint: Minimum crash point of 1.35x to ensure game runs for 5+ seconds
  // 1.03^10 = ~1.34. So 10 ticks (5 seconds) minimum.
  if (crashPoint < 1.35) {
    return 1.35;
  }

  // Cap at reasonable max to avoid overflow/long games (e.g. 1000x)
  if (crashPoint > 1000) return 1000;

  return parseFloat(crashPoint.toFixed(2));
}

// Tick generator takes a pre-determined target
export function createTickGenerator(targetMultiplier: number) {
  let current = 1.00;
  // Growth rate per tick (500ms). 
  // Slowed down to 3% per tick to give blockchain time to sync (10 ticks = 5s)
  const growthRate = 1.03;

  return function nextTick() {
    // Increase value
    current *= growthRate;

    // Check crash
    if (current >= targetMultiplier) {
      return { value: targetMultiplier, crashed: true };
    }

    return { value: parseFloat(current.toFixed(2)), crashed: false };
  };
}
