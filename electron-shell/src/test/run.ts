/**
 * Test runner for TermNexus
 */

// Run all tests
async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   TermNexus Test Suite                  ║');
  console.log('╚════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  let passed = 0;
  let failed = 0;

  // Track original console methods
  const originalLog = console.log;
  const originalError = console.error;

  // Override to count results
  const testResults: { name: string; passed: boolean }[] = [];

  console.log = (...args: any[]) => {
    originalLog(...args);
    const message = args.join(' ');
    if (message.includes('✓')) {
      passed++;
      testResults.push({ name: message.replace('  ✓ ', ''), passed: true });
    } else if (message.includes('✗')) {
      failed++;
      testResults.push({ name: message.replace('  ✗ ', ''), passed: false });
    }
  };

  try {
    // Import and run test modules
    const utilsTests = await import('./utils.test');
    await utilsTests.run();

    // Print summary
    const duration = Date.now() - startTime;

    console.log('\n─────────────────────────────────────────');
    console.log(`Tests: ${passed + failed} total, ${passed} passed, ${failed} failed`);
    console.log(`Duration: ${duration}ms`);
    console.log('─────────────────────────────────────────\n');

    if (failed > 0) {
      console.log('Failed tests:');
      testResults
        .filter(r => !r.passed)
        .forEach(r => console.log(`  - ${r.name}`));
      console.log('');
      process.exit(1);
    } else {
      console.log('✅ All tests passed!\n');
      process.exit(0);
    }
  } catch (error) {
    console.error('Test runner error:', error);
    process.exit(1);
  } finally {
    // Restore console methods
    console.log = originalLog;
    console.error = originalError;
  }
}

runAllTests();
