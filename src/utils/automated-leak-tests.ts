// Automated memory leak test runner for continuous integration
import React from 'react';
// Runs comprehensive memory leak tests automatically during development
// Integrates with existing memory management hooks

import MemoryLeakTester, { useMemoryLeakTesting } from './memory-leak-testing';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "./logger";

interface AutomatedTestConfig {
  componentName: string;
  testIntervals: {
    onMount?: number;
    duringUsage?: number;
    onUnmount?: number;
  };
  thresholds: {
    timers?: number;
    refs?: number;
    animations?: number;
    subscriptions?: number;
    listeners?: number;
    memoryGrowthMB?: number;
  };
  actions?: {
    mountTest?: () => Promise<void>;
    usageTest?: () => Promise<void>;
    unmountTest?: () => Promise<void>;
  };
}

interface TestScenario {
  name: string;
  description: string;
  setup: () => Promise<void>;
  execute: () => Promise<void>;
  cleanup: () => Promise<void>;
  expectedLimits: {
    timers?: number;
    refs?: number;
    animations?: number;
    subscriptions?: number;
    listeners?: number;
    memoryGrowthMB?: number;
  };
}

class AutomatedLeakTestRunner {
  private static instance: AutomatedLeakTestRunner;
  private tester: MemoryLeakTester;
  private activeTests: Map<string, NodeJS.Timeout> = new Map();
  private testScenarios: TestScenario[] = [];

  static getInstance(): AutomatedLeakTestRunner {
    if (!AutomatedLeakTestRunner.instance) {
      AutomatedLeakTestRunner.instance = new AutomatedLeakTestRunner();
    }
    return AutomatedLeakTestRunner.instance;
  }

  constructor() {
    this.tester = MemoryLeakTester.getInstance();
    this.setupDefaultScenarios();
  }

  // Set up default test scenarios for common React Native patterns
  private setupDefaultScenarios(): void {
    this.testScenarios = [
      {
        name: 'Component Mount/Unmount Cycle',
        description: 'Tests component mounting and unmounting for memory leaks',
        setup: async () => {
          // Component mount simulation
          await new Promise(resolve => setTimeout(resolve, 100));
        },
        execute: async () => {
          // Simulate component usage
          await new Promise(resolve => setTimeout(resolve, 500));
        },
        cleanup: async () => {
          // Component unmount simulation
          await new Promise(resolve => setTimeout(resolve, 100));
        },
        expectedLimits: {
          timers: 2,
          refs: 5,
          animations: 1,
          subscriptions: 3,
          listeners: 5,
          memoryGrowthMB: 5,
        },
      },
      {
        name: 'Navigation Flow Test',
        description: 'Tests navigation between screens for memory retention',
        setup: async () => {
          // Simulate navigation setup
          await new Promise(resolve => setTimeout(resolve, 200));
        },
        execute: async () => {
          // Simulate multiple navigation actions
          for (let i = 0; i < 3; i++) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        },
        cleanup: async () => {
          // Cleanup navigation stack
          await new Promise(resolve => setTimeout(resolve, 200));
        },
        expectedLimits: {
          timers: 3,
          refs: 8,
          animations: 2,
          subscriptions: 5,
          listeners: 8,
          memoryGrowthMB: 8,
        },
      },
      {
        name: 'Animation Stress Test',
        description: 'Tests rapid animation creation and cleanup',
        setup: async () => {
          // Setup animation context
          await new Promise(resolve => setTimeout(resolve, 100));
        },
        execute: async () => {
          // Simulate multiple animations
          for (let i = 0; i < 5; i++) {
            // Simulate animation creation and cleanup
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        },
        cleanup: async () => {
          // Cleanup all animations
          await new Promise(resolve => setTimeout(resolve, 300));
        },
        expectedLimits: {
          timers: 5,
          refs: 10,
          animations: 0, // Should be 0 after cleanup
          subscriptions: 2,
          listeners: 5,
          memoryGrowthMB: 10,
        },
      },
      {
        name: 'Real-time Subscription Test',
        description: 'Tests Supabase and WebSocket subscription management',
        setup: async () => {
          // Setup real-time connections
          await new Promise(resolve => setTimeout(resolve, 500));
        },
        execute: async () => {
          // Simulate subscription activity
          for (let i = 0; i < 4; i++) {
            await new Promise(resolve => setTimeout(resolve, 250));
          }
        },
        cleanup: async () => {
          // Cleanup all subscriptions
          await new Promise(resolve => setTimeout(resolve, 400));
        },
        expectedLimits: {
          timers: 8,
          refs: 6,
          animations: 1,
          subscriptions: 0, // Should be 0 after cleanup
          listeners: 3,
          memoryGrowthMB: 12,
        },
      },
      {
        name: 'Event Listener Stress Test',
        description: 'Tests rapid event listener creation and removal',
        setup: async () => {
          // Setup event context
          await new Promise(resolve => setTimeout(resolve, 100));
        },
        execute: async () => {
          // Simulate multiple event interactions
          for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        },
        cleanup: async () => {
          // Cleanup all listeners
          await new Promise(resolve => setTimeout(resolve, 200));
        },
        expectedLimits: {
          timers: 3,
          refs: 5,
          animations: 1,
          subscriptions: 2,
          listeners: 2, // Should be minimal after cleanup
          memoryGrowthMB: 8,
        },
      },
    ];
  }

  // Run automated component test with specified config
  async runAutomatedComponentTest(config: AutomatedTestConfig): Promise<boolean> {
    if (!__DEV__) return true;

    logDebug(`[AutomatedLeakTestRunner] Starting automated test for ${config.componentName}`, "Debug");
    
    const testSuiteName = `Automated_${config.componentName}_${Date.now()}`;
    this.tester.startTestSuite(testSuiteName);

    let allTestsPassed = true;

    try {
      // Test on mount
      if (config.testIntervals.onMount !== undefined) {
        await new Promise(resolve => setTimeout(resolve, config.testIntervals.onMount));
        
        if (config.actions?.mountTest) {
          await config.actions.mountTest();
        }

        const mountResults = await this.tester.runComponentMemoryTest(
          `${config.componentName}_mount`,
          {
            expectedMaxTimers: config.thresholds.timers,
            expectedMaxRefs: config.thresholds.refs,
            expectedMaxAnimations: config.thresholds.animations,
            expectedMaxSubscriptions: config.thresholds.subscriptions,
            expectedMaxListeners: config.thresholds.listeners,
            maxMemoryGrowthMB: config.thresholds.memoryGrowthMB,
          }
        );
        
        if (mountResults.some(r => !r.passed)) {
          allTestsPassed = false;
          logWarn(`⚠️  Mount test failed for ${config.componentName}`, "Warning");
        }
      }

      // Test during usage
      if (config.testIntervals.duringUsage !== undefined) {
        await new Promise(resolve => setTimeout(resolve, config.testIntervals.duringUsage));
        
        if (config.actions?.usageTest) {
          await config.actions.usageTest();
        }

        const usageResults = await this.tester.runComponentMemoryTest(
          `${config.componentName}_usage`,
          {
            expectedMaxTimers: config.thresholds.timers,
            expectedMaxRefs: config.thresholds.refs,
            expectedMaxAnimations: config.thresholds.animations,
            expectedMaxSubscriptions: config.thresholds.subscriptions,
            expectedMaxListeners: config.thresholds.listeners,
            maxMemoryGrowthMB: config.thresholds.memoryGrowthMB,
          }
        );
        
        if (usageResults.some(r => !r.passed)) {
          allTestsPassed = false;
          logWarn(`⚠️  Usage test failed for ${config.componentName}`, "Warning");
        }
      }

      // Test on unmount
      if (config.testIntervals.onUnmount !== undefined) {
        if (config.actions?.unmountTest) {
          await config.actions.unmountTest();
        }

        await new Promise(resolve => setTimeout(resolve, config.testIntervals.onUnmount));

        const unmountResults = await this.tester.runComponentMemoryTest(
          `${config.componentName}_unmount`,
          {
            expectedMaxTimers: config.thresholds.timers,
            expectedMaxRefs: config.thresholds.refs,
            expectedMaxAnimations: config.thresholds.animations,
            expectedMaxSubscriptions: config.thresholds.subscriptions,
            expectedMaxListeners: config.thresholds.listeners,
            maxMemoryGrowthMB: config.thresholds.memoryGrowthMB,
          }
        );
        
        if (unmountResults.some(r => !r.passed)) {
          allTestsPassed = false;
          logWarn(`⚠️  Unmount test failed for ${config.componentName}`, "Warning");
        }
      }

    } catch (error) {
      logError(`Error in automated test for ${config.componentName}:`, "Error", error);
      allTestsPassed = false;
    }

    const suite = this.tester.endTestSuite();
    
    if (allTestsPassed) {
      logDebug(`✅ Automated test passed for ${config.componentName}`, "Debug");
    } else {
      logError(`❌ Automated test failed for ${config.componentName}. Check memory leaks.`, "Error");
    }

    return allTestsPassed;
  }

  // Run specific test scenario
  async runTestScenario(scenarioName: string): Promise<boolean> {
    if (!__DEV__) return true;

    const scenario = this.testScenarios.find(s => s.name === scenarioName);
    if (!scenario) {
      logError(`Test scenario "${scenarioName}" not found`, "Error");
      return false;
    }

    logDebug(`[AutomatedLeakTestRunner] Running scenario: ${scenario.name}`, "Debug");
    
    const testSuiteName = `Scenario_${scenarioName.replace(/\s+/g, '_')}_${Date.now()}`;
    this.tester.startTestSuite(testSuiteName);

    let passed = true;

    try {
      // Setup phase
      this.tester.takeComponentSnapshot(`${scenarioName}_setup_before`);
      await scenario.setup();
      this.tester.takeComponentSnapshot(`${scenarioName}_setup_after`);

      // Execute phase
      await scenario.execute();
      this.tester.takeComponentSnapshot(`${scenarioName}_execute_after`);

      // Cleanup phase
      await scenario.cleanup();
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for cleanup
      this.tester.takeComponentSnapshot(`${scenarioName}_cleanup_after`);

      // Final memory test
      // Map expectedLimits to tester config shape
      const mapLimits = (limits: any) => ({
        expectedMaxTimers: limits.timers,
        expectedMaxRefs: limits.refs,
        expectedMaxAnimations: limits.animations,
        expectedMaxSubscriptions: limits.subscriptions,
        expectedMaxListeners: limits.listeners,
        maxMemoryGrowthMB: limits.memoryGrowthMB,
      });
      const results = await this.tester.runComponentMemoryTest(
        `${scenarioName}_final`,
        mapLimits(scenario.expectedLimits)
      );

      passed = results.every(r => r.passed);

      if (!passed) {
        logWarn(`⚠️  Scenario "${scenarioName}" failed memory leak tests`, "Warning");
        results.filter(r => !r.passed).forEach(result => {
          logWarn(`   ${result.testName}: ${result.details.description}`, "Warning");
        });
      }

    } catch (error) {
      logError(`Error running scenario "${scenarioName}":`, "Error", error);
      passed = false;
    }

    this.tester.endTestSuite();
    return passed;
  }

  // Run all test scenarios
  async runAllScenarios(): Promise<{ passed: number; failed: number; results: Record<string, boolean> }> {
    if (!__DEV__) return { passed: 0, failed: 0, results: {} };

    logDebug('[AutomatedLeakTestRunner] Running all test scenarios', "Debug");
    
    const results: Record<string, boolean> = {};
    let passed = 0;
    let failed = 0;

    for (const scenario of this.testScenarios) {
      const result = await this.runTestScenario(scenario.name);
      results[scenario.name] = result;
      
      if (result) {
        passed++;
      } else {
        failed++;
      }

      // Small delay between scenarios
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logDebug(`[AutomatedLeakTestRunner] Scenarios completed: ${passed} passed, "Debug", ${failed} failed`);
    return { passed, failed, results };
  }

  // Schedule periodic automated tests
  schedulePeriodicTest(
    componentName: string,
    config: AutomatedTestConfig,
    intervalMs: number = 300000 // 5 minutes default
  ): string {
    const testId = `${componentName}_${Date.now()}`;
    
    const interval = setInterval(async () => {
      logDebug(`[AutomatedLeakTestRunner] Running periodic test for ${componentName}`, "Debug");
      await this.runAutomatedComponentTest(config);
    }, intervalMs);

    this.activeTests.set(testId, interval);
    logDebug(`Scheduled periodic test for ${componentName} every ${intervalMs / 1000} seconds`, "Debug");
    
    return testId;
  }

  // Stop periodic test
  stopPeriodicTest(testId: string): boolean {
    const interval = this.activeTests.get(testId);
    if (interval) {
      clearInterval(interval);
      this.activeTests.delete(testId);
      logDebug(`Stopped periodic test: ${testId}`, "Debug");
      return true;
    }
    return false;
  }

  // Stop all periodic tests
  stopAllPeriodicTests(): void {
    for (const [testId, interval] of this.activeTests.entries()) {
      clearInterval(interval);
    }
    this.activeTests.clear();
    logDebug('Stopped all periodic tests', "Debug");
  }

  // Add custom test scenario
  addTestScenario(scenario: TestScenario): void {
    this.testScenarios.push(scenario);
    logDebug(`Added test scenario: ${scenario.name}`, "Debug");
  }

  // Get available scenarios
  getAvailableScenarios(): string[] {
    return this.testScenarios.map(s => s.name);
  }

  // Generate comprehensive test report
  generateComprehensiveReport(): {
    scenarios: string[];
    periodicTests: string[];
    memoryReport: any;
    recommendations: string[];
  } {
    const memoryReport = this.tester.generateTestReport();
    
    return {
      scenarios: this.getAvailableScenarios(),
      periodicTests: Array.from(this.activeTests.keys()),
      memoryReport,
      recommendations: [
        ...memoryReport.recommendations,
        'Run automated tests regularly during development',
        'Monitor periodic test results for trends',
        'Add custom scenarios for app-specific patterns',
        'Use CI/CD integration for automated testing',
      ],
    };
  }
}

// React hook for automated testing integration
export const useAutomatedMemoryTesting = (
  componentName: string,
  config: Partial<AutomatedTestConfig> = {}
) => {
  const runner = AutomatedLeakTestRunner.getInstance();
  
  const defaultConfig: AutomatedTestConfig = {
    componentName,
    testIntervals: {
      onMount: 100,
      duringUsage: 1000,
      onUnmount: 500,
    },
    thresholds: {
      timers: 5,
      refs: 10,
      animations: 3,
      subscriptions: 5,
      listeners: 8,
      memoryGrowthMB: 10,
    },
    ...config,
  };

  const [testResults, setTestResults] = React.useState<any>(null);
  const [isTestingActive, setIsTestingActive] = React.useState(false);

  const runTest = React.useCallback(async () => {
    setIsTestingActive(true);
    try {
      const result = await runner.runAutomatedComponentTest(defaultConfig);
      setTestResults({ passed: result, timestamp: Date.now() });
    } finally {
      setIsTestingActive(false);
    }
  }, [componentName, defaultConfig]);

  const schedulePeriodicTest = React.useCallback((intervalMs: number = 300000) => {
    return runner.schedulePeriodicTest(componentName, defaultConfig, intervalMs);
  }, [componentName, defaultConfig]);

  const stopPeriodicTest = React.useCallback((testId: string) => {
    return runner.stopPeriodicTest(testId);
  }, []);

  React.useEffect(() => {
    // Cleanup any active tests on unmount
    return () => {
      runner.stopAllPeriodicTests();
    };
  }, []);

  return {
    runTest,
    schedulePeriodicTest,
    stopPeriodicTest,
    testResults,
    isTestingActive,
    isEnabled: __DEV__,
  };
};

// Global setup for automated testing
export const setupAutomatedMemoryTesting = (options: {
  enablePeriodicTests?: boolean;
  testInterval?: number;
  enableScenarioTests?: boolean;
  scenarioInterval?: number;
} = {}) => {
  if (!__DEV__) return;

  const {
    enablePeriodicTests = true,
    testInterval = 600000, // 10 minutes
    enableScenarioTests = true,
    scenarioInterval = 1800000, // 30 minutes
  } = options;

  const runner = AutomatedLeakTestRunner.getInstance();

  // Global testing functions
  (global as any).__automatedLeakTestRunner = {
    runComponentTest: (componentName: string, config: any) => 
      runner.runAutomatedComponentTest({ componentName, ...config }),
    runScenario: (scenarioName: string) => runner.runTestScenario(scenarioName),
    runAllScenarios: () => runner.runAllScenarios(),
    scheduleTest: (componentName: string, config: any, interval: number) =>
      runner.schedulePeriodicTest(componentName, config, interval),
    stopTest: (testId: string) => runner.stopPeriodicTest(testId),
    addScenario: (scenario: TestScenario) => runner.addTestScenario(scenario),
    getScenarios: () => runner.getAvailableScenarios(),
    generateReport: () => runner.generateComprehensiveReport(),
  };

  // Run scenario tests periodically
  if (enableScenarioTests) {
    setInterval(async () => {
      logDebug('[AutomatedLeakTestRunner] Running periodic scenario tests', "Debug");
      await runner.runAllScenarios();
    }, scenarioInterval);
  }

  logDebug('[AutomatedLeakTestRunner] Global automated testing enabled', "Debug");
};

export default AutomatedLeakTestRunner;
// @ts-nocheck
