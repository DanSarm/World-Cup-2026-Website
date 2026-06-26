import {
  americanToDecimal,
  processEspnMoneylineForKnockout,
} from "./espnMatchOdds";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`✓ ${name}`);
  } else {
    failed++;
    console.error(`✗ ${name}`);
  }
}

assert(americanToDecimal(450) > americanToDecimal(-140), "+450 underdog > -140 favorite decimal");

const knockout = processEspnMoneylineForKnockout({
  homeAmerican: 450,
  awayAmerican: -140,
  drawAmerican: 270,
});
assert(knockout != null, "parses ESPN moneyline for knockout");
if (knockout) {
  assert(knockout.awayAdvanceImplied > knockout.homeAdvanceImplied, "Canada favored over RSA");
  const total = knockout.homeAdvanceImplied + knockout.awayAdvanceImplied;
  assert(Math.abs(total - 1) < 0.001, "knockout shares sum to 1");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
