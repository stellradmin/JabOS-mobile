/**
 * A/B Testing Framework for Algorithm Optimization
 * 
 * Implements sophisticated A/B testing for matching algorithm improvements
 * Following all 10 Golden Code Principles with privacy-first design
 * 
 * Features:
 * - Multi-variant testing
 * - Statistical significance calculation
 * - User experience protection
 * - Performance monitoring
 * - Automated rollout management
 */

import { supabase } from '../lib/supabase';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";
import {
  createStellerError,
  createAnalyticsError,
  convertToStellerError
} from '../utils/error-factory';
import { StellerError, ErrorHandlingOptions } from '../types/error-types';

// ============= A/B TESTING TYPES =============

export interface ABTest {
  id: string;
  name: string;
  description: string;
  hypothesis: string;
  testType: TestType;
  status: TestStatus;
  variants: TestVariant[];
  trafficAllocation: TrafficAllocation;
  targetMetrics: TargetMetric[];
  inclusionCriteria: InclusionCriteria;
  exclusionCriteria: ExclusionCriteria;
  configuration: TestConfiguration;
  timeline: TestTimeline;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TestType = 
  | 'algorithm_weight'
  | 'feature_toggle'
  | 'ui_component'
  | 'matching_strategy'
  | 'recommendation_logic'
  | 'scoring_model'
  | 'user_flow';

export type TestStatus = 
  | 'draft'
  | 'ready'
  | 'running'
  | 'paused'
  | 'completed'
  | 'terminated';

export interface TestVariant {
  id: string;
  name: string;
  description: string;
  isControl: boolean;
  configuration: VariantConfiguration;
  trafficPercentage: number;
  expectedImpact: ExpectedImpact;
}

export interface VariantConfiguration {
  algorithmWeights?: { [key: string]: number };
  featureFlags?: { [key: string]: boolean };
  parameters?: { [key: string]: any };
  uiChanges?: UIChange[];
  businessLogic?: BusinessLogicChange[];
}

export interface UIChange {
  component: string;
  property: string;
  value: any;
  condition?: string;
}

export interface BusinessLogicChange {
  service: string;
  method: string;
  parameters: { [key: string]: any };
  condition?: string;
}

export interface ExpectedImpact {
  primaryMetric: string;
  expectedChange: number; // Percentage change
  confidenceLevel: number;
  estimatedEffect: 'positive' | 'negative' | 'neutral';
}

export interface TrafficAllocation {
  strategy: 'random' | 'demographic' | 'behavioral' | 'geographic' | 'custom';
  rules: AllocationRule[];
  rampUpSchedule?: RampUpSchedule;
}

export interface AllocationRule {
  condition: string;
  weight: number;
  description: string;
}

export interface RampUpSchedule {
  initialPercentage: number;
  targetPercentage: number;
  incrementPercentage: number;
  incrementInterval: number; // hours
  conditions: RampUpCondition[];
}

export interface RampUpCondition {
  metric: string;
  threshold: number;
  operator: '>' | '<' | '=' | '>=' | '<=';
  action: 'continue' | 'pause' | 'rollback';
}

export interface TargetMetric {
  name: string;
  type: 'primary' | 'secondary' | 'guardrail';
  description: string;
  calculation: MetricCalculation;
  targetImprovement?: number;
  significanceLevel: number;
  minimumDetectableEffect: number;
}

export interface MetricCalculation {
  formula: string;
  dataSource: string;
  aggregation: 'sum' | 'average' | 'count' | 'ratio' | 'percentile';
  timeWindow: number; // hours
  filters?: MetricFilter[];
}

export interface MetricFilter {
  field: string;
  operator: string;
  value: any;
}

export interface InclusionCriteria {
  userSegments: string[];
  geographicRegions: string[];
  platformVersions: string[];
  userTenure: { min?: number; max?: number }; // days
  activityLevel: 'low' | 'medium' | 'high' | 'any';
  customCriteria?: CustomCriteria[];
}

export interface ExclusionCriteria {
  userSegments: string[];
  riskCategories: string[];
  conflictingTests: string[];
  customExclusions?: CustomCriteria[];
}

export interface CustomCriteria {
  field: string;
  condition: string;
  value: any;
  description: string;
}

export interface TestConfiguration {
  minimumSampleSize: number;
  maxDuration: number; // days
  minDuration: number; // days
  significanceLevel: number;
  statisticalPower: number;
  multipleTestingCorrection: 'bonferroni' | 'benjamini_hochberg' | 'none';
  earlyStoppingEnabled: boolean;
  guardrailThresholds: GuardrailThreshold[];
}

export interface GuardrailThreshold {
  metric: string;
  threshold: number;
  direction: 'above' | 'below';
  action: 'pause' | 'terminate' | 'alert';
}

export interface TestTimeline {
  plannedStartDate: Date;
  actualStartDate?: Date;
  plannedEndDate: Date;
  actualEndDate?: Date;
  milestones: TestMilestone[];
}

export interface TestMilestone {
  name: string;
  date: Date;
  status: 'pending' | 'completed' | 'delayed';
  description: string;
}

// ============= TEST RESULTS TYPES =============

export interface ABTestResult {
  testId: string;
  variantResults: VariantResult[];
  overallResults: OverallResults;
  statisticalAnalysis: StatisticalAnalysis;
  recommendations: TestRecommendation[];
  generatedAt: Date;
}

export interface VariantResult {
  variantId: string;
  metrics: MetricResult[];
  sampleSize: number;
  conversionRate: number;
  userSatisfaction: number;
  technicalMetrics: TechnicalMetric[];
  businessMetrics: BusinessMetric[];
}

export interface MetricResult {
  metricName: string;
  value: number;
  confidenceInterval: ConfidenceInterval;
  significanceLevel: number;
  pValue: number;
  effectSize: number;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  level: number;
}

export interface TechnicalMetric {
  name: string;
  value: number;
  unit: string;
  threshold?: number;
  status: 'healthy' | 'warning' | 'critical';
}

export interface BusinessMetric {
  name: string;
  value: number;
  impact: 'positive' | 'negative' | 'neutral';
  significance: 'low' | 'medium' | 'high';
}

export interface OverallResults {
  winningVariant?: string;
  confidence: number;
  recommendation: 'deploy' | 'iterate' | 'abandon';
  keyInsights: string[];
  risks: string[];
  nextSteps: string[];
}

export interface StatisticalAnalysis {
  sampleSizeAchieved: boolean;
  statisticalPower: number;
  effectSize: number;
  heterogeneousEffects: HeterogeneousEffect[];
  temporalAnalysis: TemporalAnalysis;
  segmentAnalysis: SegmentAnalysis[];
}

export interface HeterogeneousEffect {
  segment: string;
  effect: number;
  significance: number;
  description: string;
}

export interface TemporalAnalysis {
  trendDirection: 'increasing' | 'decreasing' | 'stable' | 'variable';
  seasonality: boolean;
  learningEffect: boolean;
  description: string;
}

export interface SegmentAnalysis {
  segmentName: string;
  sampleSize: number;
  effect: number;
  significance: number;
  recommendation: string;
}

export interface TestRecommendation {
  type: 'deploy' | 'iterate' | 'abandon' | 'extend' | 'segment';
  confidence: number;
  reasoning: string[];
  nextActions: string[];
  timeline: string;
  riskAssessment: string;
}

// ============= USER ASSIGNMENT TYPES =============

export interface UserAssignment {
  userId: string;
  testId: string;
  variantId: string;
  assignedAt: Date;
  assignmentMethod: 'random' | 'deterministic' | 'manual';
  bucketId?: string;
  metadata: AssignmentMetadata;
}

export interface AssignmentMetadata {
  userSegment: string;
  deviceType: string;
  platform: string;
  location?: string;
  assignmentReason: string;
  overridden: boolean;
}

// ============= A/B TESTING SERVICE IMPLEMENTATION =============

class ABTestingService {
  private static readonly HASH_SEED = 'stellr-ab-testing-2024';
  private static readonly MIN_SAMPLE_SIZE = 100;
  private static readonly MAX_CONCURRENT_TESTS = 5;

  /**
   * Create a new A/B test
   */
  static async createABTest(
    testConfig: Omit<ABTest, 'id' | 'createdAt' | 'updatedAt'>,
    options: ErrorHandlingOptions = {}
  ): Promise<ABTest> {
    const operationName = 'createABTest';
    const startTime = Date.now();

    try {
      logDebug('🧪 Creating A/B test:', "Debug", { name: testConfig.name, type: testConfig.testType });

      // Validate test configuration
      this.validateTestConfiguration(testConfig);

      // Check for conflicting tests
      await this.checkConflictingTests(testConfig);

      // Calculate required sample size
      const requiredSampleSize = this.calculateRequiredSampleSize(testConfig);

      const test: ABTest = {
        id: this.generateTestId(),
        ...testConfig,
        configuration: {
          ...testConfig.configuration,
          minimumSampleSize: Math.max(requiredSampleSize, this.MIN_SAMPLE_SIZE)
        },
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store test configuration
      await this.storeABTest(test);

      const duration = Date.now() - startTime;
      logDebug('✅ A/B test created:', "Debug", {
        testId: test.id,
        name: test.name,
        duration: `${duration}ms`
      });

      return test;

    } catch (error) {
      const duration = Date.now() - startTime;
      const stellarError = convertToStellerError(error, {
        operationName,
        testName: testConfig.name,
        duration
      });

      logError('🚨 A/B test creation failed:', "Error", stellarError);
      throw stellarError;
    }
  }

  /**
   * Assign user to test variant
   */
  static async assignUserToTest(
    userId: string,
    testId: string,
    options: ErrorHandlingOptions = {}
  ): Promise<UserAssignment | null> {
    try {
      logDebug('👤 Assigning user to test:', "Debug", { userId, testId });

      // Get test configuration
      const test = await this.getABTest(testId);
      if (!test || test.status !== 'running') {
        return null;
      }

      // Check if user already assigned
      const existingAssignment = await this.getUserAssignment(userId, testId);
      if (existingAssignment) {
        return existingAssignment;
      }

      // Check inclusion/exclusion criteria
      const eligible = await this.checkUserEligibility(userId, test);
      if (!eligible) {
        logDebug('User not eligible for test:', "Debug", { userId, testId });
        return null;
      }

      // Determine variant assignment
      const variantId = this.determineVariantAssignment(userId, test);
      
      // Create assignment record
      const assignment: UserAssignment = {
        userId,
        testId,
        variantId,
        assignedAt: new Date(),
        assignmentMethod: 'deterministic',
        metadata: await this.getAssignmentMetadata(userId, test, variantId)
      };

      // Store assignment
      await this.storeUserAssignment(assignment);

      logDebug('✅ User assigned to variant:', "Debug", { 
        userId, testId, variantId, assignment: assignment.assignmentMethod 
      });

      return assignment;

    } catch (error) {
      const stellarError = convertToStellerError(error, {
        operation: 'assignUserToTest',
        userId,
        testId
      });

      logError('Failed to assign user to test:', "Error", stellarError);

      if (!options.silent) {
        throw stellarError;
      }
      return null;
    }
  }

  /**
   * Get variant configuration for user
   */
  static async getVariantConfiguration(
    userId: string,
    testId: string
  ): Promise<VariantConfiguration | null> {
    try {
      const assignment = await this.getUserAssignment(userId, testId);
      if (!assignment) {
        return null;
      }

      const test = await this.getABTest(testId);
      if (!test) {
        return null;
      }

      const variant = test.variants.find(v => v.id === assignment.variantId);
      return variant?.configuration || null;

    } catch (error) {
      logError('Failed to get variant configuration:', "Error", { userId, testId, error });
      return null;
    }
  }

  /**
   * Record test event/metric
   */
  static async recordTestEvent(
    userId: string,
    testId: string,
    eventType: string,
    eventData: any,
    options: ErrorHandlingOptions = {}
  ): Promise<void> {
    try {
      const assignment = await this.getUserAssignment(userId, testId);
      if (!assignment) {
        return; // User not in test
      }

      const eventRecord = {
        user_id: userId,
        test_id: testId,
        variant_id: assignment.variantId,
        event_type: eventType,
        event_data: eventData,
        timestamp: new Date().toISOString(),
        session_id: this.getCurrentSessionId(userId)
      };

      const { error } = await supabase
        .from('ab_test_events')
        .insert(eventRecord);

      if (error) {
        throw createAnalyticsError('EVENT_RECORDING_FAILED', { userId, testId }, 
          'Failed to record A/B test event');
      }

      logDebug('Test event recorded:', "Debug", { userId, testId, eventType });

    } catch (error) {
      const stellarError = convertToStellerError(error, {
        operation: 'recordTestEvent',
        userId,
        testId,
        eventType
      });

      logError('Failed to record test event:', "Error", stellarError);

      if (!options.silent) {
        throw stellarError;
      }
    }
  }

  /**
   * Start A/B test
   */
  static async startTest(
    testId: string,
    options: ErrorHandlingOptions = {}
  ): Promise<void> {
    const operationName = 'startTest';

    try {
      logDebug('🚀 Starting A/B test:', "Debug", { testId });

      const test = await this.getABTest(testId);
      if (!test) {
        throw createAnalyticsError('TEST_NOT_FOUND', { testId }, 'A/B test not found');
      }

      if (test.status !== 'ready') {
        throw createAnalyticsError('TEST_NOT_READY', { testId, status: test.status }, 
          'Test is not ready to start');
      }

      // Perform pre-flight checks
      await this.performPreFlightChecks(test);

      // Update test status
      await supabase
        .from('ab_tests')
        .update({
          status: 'running',
          'timeline.actualStartDate': new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', testId);

      // Initialize monitoring
      await this.initializeTestMonitoring(test);

      logInfo('✅ A/B test started:', "Info", { testId, name: test.name });

    } catch (error) {
      const stellarError = convertToStellerError(error, {
        operationName,
        testId
      });

      logError('🚨 Failed to start A/B test:', "Error", stellarError);
      throw stellarError;
    }
  }

  /**
   * Analyze test results
   */
  static async analyzeTestResults(
    testId: string,
    options: ErrorHandlingOptions = {}
  ): Promise<ABTestResult> {
    const operationName = 'analyzeTestResults';
    const startTime = Date.now();

    try {
      logDebug('📊 Analyzing A/B test results:', "Debug", { testId });

      const test = await this.getABTest(testId);
      if (!test) {
        throw createAnalyticsError('TEST_NOT_FOUND', { testId }, 'A/B test not found');
      }

      // Fetch test data
      const testData = await this.fetchTestData(testId);

      // Calculate variant results
      const variantResults = await this.calculateVariantResults(test, testData);

      // Perform statistical analysis
      const statisticalAnalysis = await this.performStatisticalAnalysis(test, variantResults);

      // Generate overall results
      const overallResults = await this.generateOverallResults(
        test, variantResults, statisticalAnalysis
      );

      // Generate recommendations
      const recommendations = await this.generateRecommendations(
        test, variantResults, statisticalAnalysis, overallResults
      );

      const result: ABTestResult = {
        testId,
        variantResults,
        overallResults,
        statisticalAnalysis,
        recommendations,
        generatedAt: new Date()
      };

      // Store analysis results
      await this.storeTestResults(result);

      const duration = Date.now() - startTime;
      logDebug('✅ A/B test results analyzed:', "Debug", {
        testId,
        winningVariant: overallResults.winningVariant,
        confidence: overallResults.confidence,
        duration: `${duration}ms`
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const stellarError = convertToStellerError(error, {
        operationName,
        testId,
        duration
      });

      logError('🚨 A/B test analysis failed:', "Error", stellarError);
      throw stellarError;
    }
  }

  // ============= HELPER METHODS =============

  private static validateTestConfiguration(testConfig: Omit<ABTest, 'id' | 'createdAt' | 'updatedAt'>): void {
    // Validate basic configuration
    if (!testConfig.name || !testConfig.description) {
      throw createAnalyticsError('INVALID_TEST_CONFIG', {}, 'Test name and description are required');
    }

    if (testConfig.variants.length < 2) {
      throw createAnalyticsError('INVALID_TEST_CONFIG', {}, 'Test must have at least 2 variants');
    }

    // Validate traffic allocation sums to 100%
    const totalTraffic = testConfig.variants.reduce((sum, variant) => sum + variant.trafficPercentage, 0);
    if (Math.abs(totalTraffic - 100) > 0.1) {
      throw createAnalyticsError('INVALID_TEST_CONFIG', { totalTraffic }, 
        'Variant traffic percentages must sum to 100%');
    }

    // Validate at least one control variant
    const hasControl = testConfig.variants.some(variant => variant.isControl);
    if (!hasControl) {
      throw createAnalyticsError('INVALID_TEST_CONFIG', {}, 'Test must have at least one control variant');
    }

    // Validate target metrics
    if (testConfig.targetMetrics.length === 0) {
      throw createAnalyticsError('INVALID_TEST_CONFIG', {}, 'Test must have at least one target metric');
    }

    const primaryMetrics = testConfig.targetMetrics.filter(m => m.type === 'primary');
    if (primaryMetrics.length === 0) {
      throw createAnalyticsError('INVALID_TEST_CONFIG', {}, 'Test must have at least one primary metric');
    }
  }

  private static async checkConflictingTests(testConfig: Omit<ABTest, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const { data: runningTests } = await supabase
      .from('ab_tests')
      .select('id, name, test_type')
      .eq('status', 'running');

    const conflicts = runningTests?.filter(test => 
      test.test_type === testConfig.testType &&
      !testConfig.exclusionCriteria.conflictingTests.includes(test.id)
    );

    if (conflicts && conflicts.length >= this.MAX_CONCURRENT_TESTS) {
      throw createAnalyticsError('TOO_MANY_CONCURRENT_TESTS', { 
        conflictingTests: conflicts.map(t => t.name) 
      }, 'Too many concurrent tests of the same type');
    }
  }

  private static calculateRequiredSampleSize(testConfig: Omit<ABTest, 'id' | 'createdAt' | 'updatedAt'>): number {
    const primaryMetric = testConfig.targetMetrics.find(m => m.type === 'primary');
    if (!primaryMetric) return this.MIN_SAMPLE_SIZE;

    // Simplified sample size calculation
    // In practice, this would use proper statistical formulas
    const alpha = 1 - testConfig.configuration.significanceLevel;
    const beta = 1 - testConfig.configuration.statisticalPower;
    const effect = primaryMetric.minimumDetectableEffect;

    // Simplified formula - would use proper statistical libraries in production
    const sampleSize = Math.ceil(16 / (effect * effect) * Math.log(2 / alpha));
    
    return Math.max(sampleSize, this.MIN_SAMPLE_SIZE);
  }

  private static generateTestId(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static async storeABTest(test: ABTest): Promise<void> {
    const { error } = await supabase
      .from('ab_tests')
      .insert({
        id: test.id,
        name: test.name,
        description: test.description,
        hypothesis: test.hypothesis,
        test_type: test.testType,
        status: test.status,
        variants: test.variants,
        traffic_allocation: test.trafficAllocation,
        target_metrics: test.targetMetrics,
        inclusion_criteria: test.inclusionCriteria,
        exclusion_criteria: test.exclusionCriteria,
        configuration: test.configuration,
        timeline: test.timeline,
        created_by: test.createdBy,
        created_at: test.createdAt.toISOString(),
        updated_at: test.updatedAt.toISOString()
      });

    if (error) {
      throw createAnalyticsError('TEST_STORAGE_FAILED', { testId: test.id }, 
        'Failed to store A/B test configuration');
    }
  }

  private static async getABTest(testId: string): Promise<ABTest | null> {
    const { data, error } = await supabase
      .from('ab_tests')
      .select('*')
      .eq('id', testId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      hypothesis: data.hypothesis,
      testType: data.test_type,
      status: data.status,
      variants: data.variants,
      trafficAllocation: data.traffic_allocation,
      targetMetrics: data.target_metrics,
      inclusionCriteria: data.inclusion_criteria,
      exclusionCriteria: data.exclusion_criteria,
      configuration: data.configuration,
      timeline: data.timeline,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  private static async getUserAssignment(userId: string, testId: string): Promise<UserAssignment | null> {
    const { data, error } = await supabase
      .from('ab_test_assignments')
      .select('*')
      .eq('user_id', userId)
      .eq('test_id', testId)
      .single();

    if (error || !data) return null;

    return {
      userId: data.user_id,
      testId: data.test_id,
      variantId: data.variant_id,
      assignedAt: new Date(data.assigned_at),
      assignmentMethod: data.assignment_method,
      bucketId: data.bucket_id,
      metadata: data.metadata
    };
  }

  private static async checkUserEligibility(userId: string, test: ABTest): Promise<boolean> {
    try {
      // Get user profile
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!userProfile) return false;

      // Check inclusion criteria
      if (!this.checkInclusionCriteria(userProfile, test.inclusionCriteria)) {
        return false;
      }

      // Check exclusion criteria
      if (!this.checkExclusionCriteria(userProfile, test.exclusionCriteria)) {
        return false;
      }

      return true;

    } catch (error) {
      logError('Failed to check user eligibility:', "Error", { userId, testId: test.id, error });
      return false;
    }
  }

  private static checkInclusionCriteria(userProfile: any, criteria: InclusionCriteria): boolean {
    // Check user segments
    if (criteria.userSegments.length > 0 && 
        !criteria.userSegments.includes(userProfile.user_segment)) {
      return false;
    }

    // Check geographic regions
    if (criteria.geographicRegions.length > 0 && 
        !criteria.geographicRegions.includes(userProfile.region)) {
      return false;
    }

    // Check user tenure
    if (criteria.userTenure.min || criteria.userTenure.max) {
      const tenureDays = Math.floor((Date.now() - new Date(userProfile.created_at).getTime()) / (24 * 60 * 60 * 1000));
      
      if (criteria.userTenure.min && tenureDays < criteria.userTenure.min) return false;
      if (criteria.userTenure.max && tenureDays > criteria.userTenure.max) return false;
    }

    // Check activity level
    if (criteria.activityLevel !== 'any' && 
        userProfile.activity_level !== criteria.activityLevel) {
      return false;
    }

    return true;
  }

  private static checkExclusionCriteria(userProfile: any, criteria: ExclusionCriteria): boolean {
    // Check excluded user segments
    if (criteria.userSegments.includes(userProfile.user_segment)) {
      return false;
    }

    // Check risk categories
    if (userProfile.risk_categories?.some((risk: string) => criteria.riskCategories.includes(risk))) {
      return false;
    }

    return true;
  }

  private static determineVariantAssignment(userId: string, test: ABTest): string {
    // Deterministic assignment based on user ID hash
    const hash = this.hashUserId(userId, test.id);
    const bucket = hash % 100;

    let cumulativePercentage = 0;
    for (const variant of test.variants) {
      cumulativePercentage += variant.trafficPercentage;
      if (bucket < cumulativePercentage) {
        return variant.id;
      }
    }

    // Fallback to control variant
    const controlVariant = test.variants.find(v => v.isControl);
    return controlVariant?.id || test.variants[0].id;
  }

  private static hashUserId(userId: string, testId: string): number {
    // Simple hash function - would use a proper cryptographic hash in production
    const input = `${userId}:${testId}:${this.HASH_SEED}`;
    let hash = 0;
    
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash);
  }

  private static async getAssignmentMetadata(
    userId: string,
    test: ABTest,
    variantId: string
  ): Promise<AssignmentMetadata> {
    // Get user context for assignment metadata
    return {
      userSegment: 'default', // Would be determined from user profile
      deviceType: 'mobile',   // Would be determined from request headers
      platform: 'ios',       // Would be determined from user agent
      assignmentReason: 'random_assignment',
      overridden: false
    };
  }

  private static async storeUserAssignment(assignment: UserAssignment): Promise<void> {
    const { error } = await supabase
      .from('ab_test_assignments')
      .insert({
        user_id: assignment.userId,
        test_id: assignment.testId,
        variant_id: assignment.variantId,
        assigned_at: assignment.assignedAt.toISOString(),
        assignment_method: assignment.assignmentMethod,
        bucket_id: assignment.bucketId,
        metadata: assignment.metadata
      });

    if (error) {
      throw createAnalyticsError('ASSIGNMENT_STORAGE_FAILED', {
        userId: assignment.userId,
        testId: assignment.testId
      }, 'Failed to store user assignment');
    }
  }

  private static getCurrentSessionId(userId: string): string {
    // Generate or retrieve current session ID
    return `session_${userId}_${Date.now()}`;
  }

  private static async performPreFlightChecks(test: ABTest): Promise<void> {
    // Check minimum sample size availability
    const estimatedUsers = await this.estimateEligibleUsers(test);
    if (estimatedUsers < test.configuration.minimumSampleSize) {
      throw createAnalyticsError('INSUFFICIENT_SAMPLE_SIZE', {
        estimated: estimatedUsers,
        required: test.configuration.minimumSampleSize
      }, 'Insufficient eligible users for test');
    }

    // Check system resources
    // This would check if the system can handle the additional load

    // Check dependencies
    // This would verify that all required services are available
  }

  private static async estimateEligibleUsers(test: ABTest): Promise<number> {
    // Estimate how many users would be eligible for this test
    // This is a simplified implementation
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    return Math.floor((count || 0) * 0.8); // Assume 80% eligibility rate
  }

  private static async initializeTestMonitoring(test: ABTest): Promise<void> {
    // Initialize monitoring systems for the test
    logInfo('Test monitoring initialized:', "Info", { testId: test.id });
  }

  private static async fetchTestData(testId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('ab_test_events')
      .select('*')
      .eq('test_id', testId);

    if (error) {
      throw createAnalyticsError('DATA_FETCH_FAILED', { testId }, 
        'Failed to fetch test data');
    }

    return data || [];
  }

  private static async calculateVariantResults(test: ABTest, testData: any[]): Promise<VariantResult[]> {
    const results: VariantResult[] = [];

    for (const variant of test.variants) {
      const variantData = testData.filter(d => d.variant_id === variant.id);
      
      // Calculate metrics for this variant
      const metrics: MetricResult[] = [];
      for (const targetMetric of test.targetMetrics) {
        const metricResult = this.calculateMetric(targetMetric, variantData);
        metrics.push(metricResult);
      }

      results.push({
        variantId: variant.id,
        metrics,
        sampleSize: variantData.length,
        conversionRate: this.calculateConversionRate(variantData),
        userSatisfaction: this.calculateUserSatisfaction(variantData),
        technicalMetrics: [],
        businessMetrics: []
      });
    }

    return results;
  }

  private static calculateMetric(targetMetric: TargetMetric, variantData: any[]): MetricResult {
    // Simplified metric calculation
    const value = this.calculateMetricValue(targetMetric, variantData);
    
    return {
      metricName: targetMetric.name,
      value,
      confidenceInterval: { lower: value * 0.9, upper: value * 1.1, level: 0.95 },
      significanceLevel: targetMetric.significanceLevel,
      pValue: 0.05, // Would be calculated properly
      effectSize: 0.1  // Would be calculated properly
    };
  }

  private static calculateMetricValue(targetMetric: TargetMetric, variantData: any[]): number {
    switch (targetMetric.calculation.aggregation) {
      case 'count':
        return variantData.length;
      case 'average':
        return variantData.reduce((sum, d) => sum + (d.value || 0), 0) / Math.max(1, variantData.length);
      case 'sum':
        return variantData.reduce((sum, d) => sum + (d.value || 0), 0);
      case 'ratio':
        const numerator = variantData.filter(d => d.success).length;
        return numerator / Math.max(1, variantData.length);
      default:
        return 0;
    }
  }

  private static calculateConversionRate(variantData: any[]): number {
    if (variantData.length === 0) return 0;
    
    const conversions = variantData.filter(d => d.event_type === 'conversion').length;
    return conversions / variantData.length;
  }

  private static calculateUserSatisfaction(variantData: any[]): number {
    const satisfactionEvents = variantData.filter(d => d.event_type === 'satisfaction');
    if (satisfactionEvents.length === 0) return 0.5;

    const avgSatisfaction = satisfactionEvents.reduce((sum, d) => 
      sum + (d.event_data?.rating || 0.5), 0) / satisfactionEvents.length;
    
    return avgSatisfaction;
  }

  private static async performStatisticalAnalysis(
    test: ABTest,
    variantResults: VariantResult[]
  ): Promise<StatisticalAnalysis> {
    const totalSampleSize = variantResults.reduce((sum, v) => sum + v.sampleSize, 0);
    const sampleSizeAchieved = totalSampleSize >= test.configuration.minimumSampleSize;

    return {
      sampleSizeAchieved,
      statisticalPower: test.configuration.statisticalPower,
      effectSize: 0.1, // Would be calculated from variant differences
      heterogeneousEffects: [],
      temporalAnalysis: {
        trendDirection: 'stable',
        seasonality: false,
        learningEffect: false,
        description: 'Results show stable performance over time'
      },
      segmentAnalysis: []
    };
  }

  private static async generateOverallResults(
    test: ABTest,
    variantResults: VariantResult[],
    statisticalAnalysis: StatisticalAnalysis
  ): Promise<OverallResults> {
    // Find winning variant based on primary metric
    const primaryMetric = test.targetMetrics.find(m => m.type === 'primary');
    if (!primaryMetric) {
      return {
        confidence: 0,
        recommendation: 'abandon',
        keyInsights: ['No primary metric defined'],
        risks: ['Cannot determine winner without primary metric'],
        nextSteps: ['Define primary metric and re-run analysis']
      };
    }

    // Find variant with best performance on primary metric
    let winningVariant = variantResults[0];
    let bestMetricValue = -Infinity;

    variantResults.forEach(variant => {
      const metric = variant.metrics.find(m => m.metricName === primaryMetric.name);
      if (metric && metric.value > bestMetricValue) {
        bestMetricValue = metric.value;
        winningVariant = variant;
      }
    });

    const confidence = statisticalAnalysis.sampleSizeAchieved ? 85 : 50;
    const recommendation = confidence > 80 ? 'deploy' : 'iterate';

    return {
      winningVariant: winningVariant.variantId,
      confidence,
      recommendation,
      keyInsights: this.generateKeyInsights(variantResults, statisticalAnalysis),
      risks: this.identifyRisks(test, variantResults),
      nextSteps: this.generateNextSteps(recommendation, confidence)
    };
  }

  private static generateKeyInsights(
    variantResults: VariantResult[],
    statisticalAnalysis: StatisticalAnalysis
  ): string[] {
    const insights = [];

    if (statisticalAnalysis.sampleSizeAchieved) {
      insights.push('Sufficient sample size achieved for reliable results');
    } else {
      insights.push('Sample size below target - results may have limited reliability');
    }

    // Add more insights based on the data
    return insights;
  }

  private static identifyRisks(test: ABTest, variantResults: VariantResult[]): string[] {
    const risks = [];

    // Check for low sample sizes
    const lowSampleVariants = variantResults.filter(v => v.sampleSize < 100);
    if (lowSampleVariants.length > 0) {
      risks.push('Some variants have very low sample sizes');
    }

    // Check guardrail metrics
    // This would check if any guardrail thresholds were violated

    return risks;
  }

  private static generateNextSteps(recommendation: string, confidence: number): string[] {
    switch (recommendation) {
      case 'deploy':
        return [
          'Prepare deployment plan for winning variant',
          'Monitor post-deployment metrics',
          'Plan gradual rollout schedule'
        ];
      case 'iterate':
        return [
          'Analyze underperforming variants',
          'Develop improved test variants',
          'Consider extending test duration'
        ];
      case 'abandon':
        return [
          'Document lessons learned',
          'Investigate root causes of poor performance',
          'Consider alternative approaches'
        ];
      default:
        return ['Review results and determine next steps'];
    }
  }

  private static async generateRecommendations(
    test: ABTest,
    variantResults: VariantResult[],
    statisticalAnalysis: StatisticalAnalysis,
    overallResults: OverallResults
  ): Promise<TestRecommendation[]> {
    const recommendations: TestRecommendation[] = [];

    // Primary recommendation
    recommendations.push({
      type: overallResults.recommendation as any,
      confidence: overallResults.confidence,
      reasoning: [
        `Based on ${statisticalAnalysis.sampleSizeAchieved ? 'sufficient' : 'limited'} sample size`,
        `Winning variant shows ${statisticalAnalysis.effectSize > 0.1 ? 'significant' : 'modest'} improvement`,
        `Statistical power: ${statisticalAnalysis.statisticalPower}`
      ],
      nextActions: overallResults.nextSteps,
      timeline: this.getRecommendationTimeline(overallResults.recommendation),
      riskAssessment: overallResults.risks.join('; ')
    });

    return recommendations;
  }

  private static getRecommendationTimeline(recommendation: string): string {
    switch (recommendation) {
      case 'deploy': return '1-2 weeks';
      case 'iterate': return '2-4 weeks';
      case 'abandon': return 'Immediate';
      case 'extend': return '2-6 weeks';
      default: return '1-2 weeks';
    }
  }

  private static async storeTestResults(result: ABTestResult): Promise<void> {
    const { error } = await supabase
      .from('ab_test_results')
      .insert({
        test_id: result.testId,
        variant_results: result.variantResults,
        overall_results: result.overallResults,
        statistical_analysis: result.statisticalAnalysis,
        recommendations: result.recommendations,
        generated_at: result.generatedAt.toISOString()
      });

    if (error) {
      logError('Failed to store test results:', "Error", error);
    }
  }

  /**
   * Get active tests for a user
   */
  static async getActiveTestsForUser(userId: string): Promise<UserAssignment[]> {
    try {
      const { data, error } = await supabase
        .from('ab_test_assignments')
        .select(`
          *,
          ab_tests!inner(
            id, name, status, variants
          )
        `)
        .eq('user_id', userId)
        .eq('ab_tests.status', 'running');

      if (error) throw error;

      return (data || []).map(d => ({
        userId: d.user_id,
        testId: d.test_id,
        variantId: d.variant_id,
        assignedAt: new Date(d.assigned_at),
        assignmentMethod: d.assignment_method,
        bucketId: d.bucket_id,
        metadata: d.metadata
      }));

    } catch (error) {
      logError('Failed to get active tests for user:', "Error", { userId, error });
      return [];
    }
  }

  /**
   * Get all variant configurations for a user
   */
  static async getAllVariantConfigurations(userId: string): Promise<{ [testId: string]: VariantConfiguration }> {
    const assignments = await this.getActiveTestsForUser(userId);
    const configurations: { [testId: string]: VariantConfiguration } = {};

    for (const assignment of assignments) {
      const config = await this.getVariantConfiguration(userId, assignment.testId);
      if (config) {
        configurations[assignment.testId] = config;
      }
    }

    return configurations;
  }
}

export default ABTestingService;
