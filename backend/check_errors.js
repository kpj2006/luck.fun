const { ethers } = require('ethers');
const errors = [
  'GameAlreadyActive()',
  'GameNotActive()',
  'Unauthorized(address)',
  'InvalidGameId(uint256)',
  'InvalidMultiplier(uint256)'
];

errors.forEach(err => {
  const hash = ethers.id(err).slice(0, 10);
  console.log(`${err}: ${hash}`);
});
