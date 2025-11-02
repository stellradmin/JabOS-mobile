import React, { useState, Children, ReactNode, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Animated, { useAnimatedStyle, withTiming, useDerivedValue } from 'react-native-reanimated';
import Svg, { Path, SvgProps } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// --- Prop Types ---

interface StepperProps {
  children: ReactNode;
  initialStep?: number;
  onStepChange?: (step: number) => void;
  onFinalStepCompleted?: () => void;
  backButtonText?: string;
  nextButtonText?: string;
}

interface StepProps {
  children: ReactNode;
}

interface StepIndicatorProps {
  step: number;
  currentStep: number;
  onClickStep: (step: number) => void;
}

interface StepConnectorProps {
  isComplete: boolean;
}

type CheckIconProps = SvgProps;

// --- Helper Components ---

const CheckIcon: React.FC<CheckIconProps> = (props) => (
  <Svg fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" {...props}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </Svg>
);

const StepConnector: React.FC<StepConnectorProps> = ({ isComplete }) => {
  const width = useDerivedValue(() => (isComplete ? withTiming(1) : withTiming(0)), [isComplete]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: width.value }],
  }));

  return (
    <View style={styles.stepConnector}>
      <Animated.View style={[styles.stepConnectorInner, animatedStyle]} />
    </View>
  );
};

const StepIndicator: React.FC<StepIndicatorProps> = ({ step, currentStep, onClickStep }) => {
  const status = currentStep > step ? 'complete' : currentStep === step ? 'active' : 'inactive';

  const indicatorStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: withTiming(status === 'complete' || status === 'active' ? '#000000' : '#222'),
    };
  });

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(status === 'active' ? 1 : 0.8) }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    color: withTiming(status === 'inactive' ? '#a3a3a3' : '#FFFFFF'),
  }));

  return (
    <TouchableOpacity onPress={() => onClickStep(step)}>
      <Animated.View style={[styles.stepIndicator, indicatorStyle]}>
        {status === 'complete' ? (
          <CheckIcon style={styles.checkIcon} />
        ) : (
          <Animated.View style={innerStyle}>
            <Animated.Text style={[styles.stepNumber, textStyle]}>{step}</Animated.Text>
          </Animated.View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

export const Step: React.FC<StepProps> = ({ children }) => <View>{children}</View>;

// --- Main Stepper Component ---

export interface StepperHandle {
  next: () => void;
  back: () => void;
}

const Stepper = forwardRef<StepperHandle, StepperProps>(function StepperComponent({
  children,
  initialStep = 1,
  onStepChange = () => {},
  onFinalStepCompleted = () => {},
  backButtonText = 'Previous',
  nextButtonText = 'Next',
}, ref) {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  // Remove height coupling to avoid clipping; allow vertical scroll instead
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  const stepsArray = Children.toArray(children);
  const totalSteps = stepsArray.length;
  const isLastStep = currentStep === totalSteps;

  const handleNext = () => {
    if (isLastStep) {
      onFinalStepCompleted();
    } else {
      const newStep = currentStep + 1;
      setSlideDirection('right');
      setCurrentStep(newStep);
      onStepChange(newStep);
    }
  };
  
  // Expose handleNext through a ref so child components can call it
  useImperativeHandle(ref, () => ({
    next: handleNext,
    back: handleBack
  }));

  const handleBack = () => {
    if (currentStep > 1) {
      const newStep = currentStep - 1;
      setSlideDirection('left');
      setCurrentStep(newStep);
      onStepChange(newStep);
    }
  };

  const handleClickStep = (step: number) => {
    if (step !== currentStep) {
      setSlideDirection(step > currentStep ? 'right' : 'left');
      setCurrentStep(step);
      onStepChange(step);
    }
  };

  // Keep placeholder slide style for future transitions (currently neutral)
  const slideAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(0, { duration: 300 }) }],
  }));

  return (
    <View style={styles.outerContainer}>
      <View style={styles.stepCircleContainer}>
        {/* Step Indicators */}
        <View style={styles.stepIndicatorRow}>
          {stepsArray.map((_, index) => {
            const stepNumber = index + 1;
            return (
              <React.Fragment key={stepNumber}>
                <StepIndicator
                  step={stepNumber}
                  currentStep={currentStep}
                  onClickStep={handleClickStep}
                />
                {index < totalSteps - 1 && <StepConnector isComplete={currentStep > stepNumber} />}
              </React.Fragment>
            );
          })}
        </View>

        {/* Step Content - scrollable to avoid cutoff on smaller screens */}
        <View style={styles.stepContentDefault}>
          <Animated.View style={[{ flex: 1 }, slideAnimatedStyle]}>
            <ScrollView
              contentContainerStyle={{ paddingBottom: Math.max(64, insets.bottom + 80), flexGrow: 1 }}
              scrollIndicatorInsets={{ bottom: insets.bottom + 16 }}
              contentInsetAdjustmentBehavior="always"
              alwaysBounceVertical
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {stepsArray[currentStep - 1]}
            </ScrollView>
          </Animated.View>
        </View>
      </View>
    </View>
  );
});

export default Stepper;

// --- Styles ---

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  stepCircleContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
  },
  stepIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  checkIcon: {
    width: 18,
    height: 18,
    color: '#fff',
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: '#d1d5db',
    marginHorizontal: 8,
  },
  stepConnectorInner: {
    height: '100%',
    width: '100%',
    backgroundColor: '#000000',
    transformOrigin: 'left',
  },
  stepContentDefault: {
    flex: 1,
  },
});
