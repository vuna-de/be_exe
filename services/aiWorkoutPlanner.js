const Exercise = require('../models/Exercise');
const { WorkoutPlan } = require('../models/Workout');
const { UserPreferences, WorkoutHistory, AIWorkoutPlan } = require('../models/Personalization');

class AIWorkoutPlanner {
  constructor() {
    this.exerciseDatabase = null;
    this.loadExerciseDatabase();
  }

  // Load exercise database for AI processing
  async loadExerciseDatabase() {
    try {
      this.exerciseDatabase = await Exercise.find({ isActive: true }).lean();
      console.log(`✅ Loaded ${this.exerciseDatabase.length} exercises for AI planning`);
    } catch (error) {
      console.error('Error loading exercise database:', error);
    }
  }

  // Main method to generate personalized workout plan
  async generatePersonalizedWorkout(userId, preferences, goals, constraints) {
    try {
      // Get user's workout history and preferences
      const userPrefs = await UserPreferences.findOne({ user: userId });
      const workoutHistory = await WorkoutHistory.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('exercise')
        .lean();

      // Analyze user's fitness level and patterns
      const fitnessAnalysis = await this.analyzeFitnessLevel(workoutHistory, userPrefs);
      
      // Generate workout plan based on analysis
      const workoutPlan = await this.createWorkoutPlan({
        userId,
        preferences: userPrefs || preferences,
        goals,
        constraints,
        fitnessAnalysis,
        workoutHistory
      });

      // Save AI-generated plan
      const aiPlan = new AIWorkoutPlan({
        user: userId,
        generationReason: 'initial_creation',
        personalizationFactors: this.extractPersonalizationFactors(preferences, fitnessAnalysis),
        performancePredictions: this.predictPerformance(workoutPlan, fitnessAnalysis),
        isActive: true
      });

      await aiPlan.save();

      return {
        plan: workoutPlan,
        aiPlanId: aiPlan._id,
        confidence: this.calculateConfidence(fitnessAnalysis),
        recommendations: this.generateRecommendations(fitnessAnalysis)
      };
    } catch (error) {
      console.error('Error generating personalized workout:', error);
      throw error;
    }
  }

  // Analyze user's fitness level and workout patterns
  async analyzeFitnessLevel(workoutHistory, preferences) {
    const analysis = {
      experienceLevel: preferences?.experienceLevel || 'beginner',
      strengthLevel: this.calculateStrengthLevel(workoutHistory),
      enduranceLevel: this.calculateEnduranceLevel(workoutHistory),
      consistency: this.calculateConsistency(workoutHistory),
      progressionRate: this.calculateProgressionRate(workoutHistory),
      preferredExercises: this.getPreferredExercises(workoutHistory),
      avoidedExercises: this.getAvoidedExercises(workoutHistory),
      injuryRisk: this.assessInjuryRisk(workoutHistory, preferences),
      recoveryTime: this.calculateRecoveryTime(workoutHistory),
      motivationLevel: preferences?.motivationLevel || 5
    };

    return analysis;
  }

  // Calculate strength level based on workout history
  calculateStrengthLevel(workoutHistory) {
    if (workoutHistory.length === 0) return 'beginner';

    const strengthExercises = workoutHistory.filter(h => 
      h.exercise?.category === 'strength' || 
      h.exercise?.primaryMuscles?.some(muscle => 
        ['chest', 'back', 'shoulders', 'biceps', 'triceps'].includes(muscle)
      )
    );

    if (strengthExercises.length === 0) return 'beginner';

    const avgWeight = strengthExercises.reduce((sum, h) => {
      const maxWeight = Math.max(...h.performance.sets.map(s => s.weight || 0));
      return sum + maxWeight;
    }, 0) / strengthExercises.length;

    if (avgWeight < 20) return 'beginner';
    if (avgWeight < 40) return 'intermediate';
    if (avgWeight < 60) return 'advanced';
    return 'expert';
  }

  // Calculate endurance level
  calculateEnduranceLevel(workoutHistory) {
    const cardioExercises = workoutHistory.filter(h => 
      h.exercise?.category === 'cardio' || 
      h.exercise?.primaryMuscles?.includes('heart')
    );

    if (cardioExercises.length === 0) return 'beginner';

    const avgDuration = cardioExercises.reduce((sum, h) => {
      const totalDuration = h.performance.sets.reduce((s, set) => s + (set.duration || 0), 0);
      return sum + totalDuration;
    }, 0) / cardioExercises.length;

    if (avgDuration < 10) return 'beginner';
    if (avgDuration < 20) return 'intermediate';
    if (avgDuration < 30) return 'advanced';
    return 'expert';
  }

  // Calculate workout consistency
  calculateConsistency(workoutHistory) {
    if (workoutHistory.length < 7) return 0.3;

    const last30Days = workoutHistory.filter(h => 
      new Date(h.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );

    const uniqueDays = new Set(last30Days.map(h => 
      new Date(h.createdAt).toDateString()
    )).size;

    return Math.min(uniqueDays / 30, 1);
  }

  // Calculate progression rate
  calculateProgressionRate(workoutHistory) {
    if (workoutHistory.length < 10) return 0.1;

    const recentWorkouts = workoutHistory.slice(0, 10);
    const olderWorkouts = workoutHistory.slice(10, 20);

    if (olderWorkouts.length === 0) return 0.1;

    const recentAvgWeight = this.getAverageWeight(recentWorkouts);
    const olderAvgWeight = this.getAverageWeight(olderWorkouts);

    if (olderAvgWeight === 0) return 0.1;

    return Math.max(0, (recentAvgWeight - olderAvgWeight) / olderAvgWeight);
  }

  // Get preferred exercises based on history
  getPreferredExercises(workoutHistory) {
    const exerciseCount = {};
    const exerciseRatings = {};

    workoutHistory.forEach(h => {
      const exerciseId = h.exercise?._id?.toString();
      if (!exerciseId) return;

      exerciseCount[exerciseId] = (exerciseCount[exerciseId] || 0) + 1;
      
      if (h.feedback?.enjoyment) {
        exerciseRatings[exerciseId] = (exerciseRatings[exerciseId] || 0) + h.feedback.enjoyment;
      }
    });

    return Object.keys(exerciseCount)
      .map(exerciseId => ({
        exerciseId,
        frequency: exerciseCount[exerciseId],
        avgRating: exerciseRatings[exerciseId] / exerciseCount[exerciseId] || 0
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }

  // Get avoided exercises
  getAvoidedExercises(workoutHistory) {
    const avoidedExercises = [];

    workoutHistory.forEach(h => {
      if (h.feedback?.enjoyment < 3 || h.performance?.pain === 'severe') {
        avoidedExercises.push({
          exerciseId: h.exercise?._id,
          reason: h.feedback?.comments || 'Low enjoyment or pain',
          lastAttempted: h.createdAt
        });
      }
    });

    return avoidedExercises;
  }

  // Assess injury risk
  assessInjuryRisk(workoutHistory, preferences) {
    let riskScore = 0;

    // Check for recent injuries
    const recentInjuries = workoutHistory.filter(h => 
      h.performance?.pain === 'severe' && 
      new Date(h.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    riskScore += recentInjuries.length * 0.3;

    // Check for poor form
    const poorForm = workoutHistory.filter(h => 
      h.performance?.form === 'poor'
    );
    riskScore += poorForm.length * 0.1;

    // Check for overtraining
    const highRPE = workoutHistory.filter(h => 
      h.performance?.averageRPE > 8
    );
    riskScore += highRPE.length * 0.05;

    // Check user's injury history
    if (preferences?.injuryHistory?.length > 0) {
      riskScore += preferences.injuryHistory.length * 0.2;
    }

    return Math.min(riskScore, 1);
  }

  // Calculate recovery time needed
  calculateRecoveryTime(workoutHistory) {
    if (workoutHistory.length < 5) return 48; // 48 hours for beginners

    const recentWorkouts = workoutHistory.slice(0, 5);
    const avgRPE = recentWorkouts.reduce((sum, h) => 
      sum + (h.performance?.averageRPE || 5), 0
    ) / recentWorkouts.length;

    // Higher RPE = more recovery time needed
    if (avgRPE < 5) return 24;
    if (avgRPE < 7) return 48;
    if (avgRPE < 9) return 72;
    return 96;
  }

  // Create personalized workout plan
  async createWorkoutPlan({ userId, preferences, goals, constraints, fitnessAnalysis, workoutHistory }) {
    const plan = {
      name: this.generatePlanName(goals, fitnessAnalysis),
      description: this.generatePlanDescription(goals, fitnessAnalysis),
      duration: constraints.duration || 4, // weeks
      frequency: preferences.workoutFrequency || 3,
      difficulty: this.calculateDifficulty(fitnessAnalysis),
      exercises: [],
      restDays: this.calculateRestDays(preferences.workoutFrequency),
      progression: this.calculateProgression(fitnessAnalysis)
    };

    // Generate exercises for each workout day
    for (let week = 1; week <= plan.duration; week++) {
      for (let day = 1; day <= plan.frequency; day++) {
        const workoutDay = await this.generateWorkoutDay({
          week,
          day,
          goals,
          fitnessAnalysis,
          preferences,
          workoutHistory,
          plan
        });
        plan.exercises.push(workoutDay);
      }
    }

    return plan;
  }

  // Generate workout for a specific day
  async generateWorkoutDay({ week, day, goals, fitnessAnalysis, preferences, workoutHistory, plan }) {
    const workoutDay = {
      week,
      day,
      name: this.getWorkoutDayName(day, goals),
      exercises: [],
      estimatedDuration: 0,
      focus: this.getWorkoutFocus(day, goals, fitnessAnalysis)
    };

    // Select exercises based on goals and fitness level
    const exerciseSelection = await this.selectExercises({
      goals,
      fitnessAnalysis,
      preferences,
      workoutHistory,
      focus: workoutDay.focus,
      day
    });

    // Add exercises to workout day
    for (const exercise of exerciseSelection) {
      const exerciseDetails = await this.configureExercise({
        exercise,
        fitnessAnalysis,
        goals,
        week,
        day
      });

      workoutDay.exercises.push(exerciseDetails);
      workoutDay.estimatedDuration += exerciseDetails.estimatedDuration;
    }

    return workoutDay;
  }

  // Select appropriate exercises
  async selectExercises({ goals, fitnessAnalysis, preferences, workoutHistory, focus, day }) {
    let exercises = [...this.exerciseDatabase];

    // Filter by equipment availability
    if (preferences.availableEquipment) {
      exercises = exercises.filter(ex => 
        !ex.equipment || 
        ex.equipment.some(eq => preferences.availableEquipment.includes(eq)) ||
        ex.equipment.includes('none')
      );
    }

    // Filter by difficulty
    exercises = exercises.filter(ex => {
      const difficultyMap = { 'beginner': 1, 'intermediate': 2, 'advanced': 3, 'expert': 4 };
      const userLevel = difficultyMap[fitnessAnalysis.experienceLevel] || 1;
      const exerciseLevel = difficultyMap[ex.difficulty] || 1;
      return Math.abs(exerciseLevel - userLevel) <= 1;
    });

    // Filter by goals
    exercises = this.filterByGoals(exercises, goals);

    // Filter by focus
    exercises = this.filterByFocus(exercises, focus);

    // Avoid exercises user doesn't like
    const avoidedIds = fitnessAnalysis.avoidedExercises.map(ae => ae.exerciseId?.toString());
    exercises = exercises.filter(ex => !avoidedIds.includes(ex._id.toString()));

    // Prioritize preferred exercises
    const preferredIds = fitnessAnalysis.preferredExercises.map(pe => pe.exerciseId);
    exercises.sort((a, b) => {
      const aPreferred = preferredIds.includes(a._id.toString());
      const bPreferred = preferredIds.includes(b._id.toString());
      if (aPreferred && !bPreferred) return -1;
      if (!aPreferred && bPreferred) return 1;
      return 0;
    });

    // Select 4-8 exercises per workout
    const numExercises = Math.min(8, Math.max(4, Math.floor(exercises.length * 0.3)));
    return exercises.slice(0, numExercises);
  }

  // Filter exercises by goals
  filterByGoals(exercises, goals) {
    const goalFilters = {
      'weight_loss': ['cardio', 'hiit', 'strength'],
      'muscle_gain': ['strength', 'hypertrophy'],
      'endurance': ['cardio', 'endurance'],
      'strength': ['strength', 'power'],
      'flexibility': ['flexibility', 'mobility'],
      'general_fitness': ['strength', 'cardio', 'flexibility']
    };

    const targetCategories = goals.flatMap(goal => goalFilters[goal] || []);
    
    return exercises.filter(ex => 
      targetCategories.length === 0 || 
      targetCategories.some(cat => ex.category === cat)
    );
  }

  // Filter exercises by focus
  filterByFocus(exercises, focus) {
    const focusFilters = {
      'upper_body': ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
      'lower_body': ['quads', 'hamstrings', 'glutes', 'calves'],
      'core': ['abs', 'obliques', 'core'],
      'full_body': ['full_body', 'cardio'],
      'cardio': ['cardio', 'heart']
    };

    const targetMuscles = focusFilters[focus] || [];
    
    return exercises.filter(ex => 
      targetMuscles.length === 0 || 
      ex.primaryMuscles?.some(muscle => targetMuscles.includes(muscle))
    );
  }

  // Configure exercise parameters
  async configureExercise({ exercise, fitnessAnalysis, goals, week, day }) {
    const baseSets = this.calculateBaseSets(exercise, fitnessAnalysis);
    const baseReps = this.calculateBaseReps(exercise, fitnessAnalysis, goals);
    const baseWeight = this.calculateBaseWeight(exercise, fitnessAnalysis);
    const restTime = this.calculateRestTime(exercise, fitnessAnalysis);

    // Apply progression
    const progressionFactor = this.calculateProgressionFactor(week, day, fitnessAnalysis);
    const finalSets = Math.max(1, Math.floor(baseSets * progressionFactor));
    const finalReps = Math.max(1, Math.floor(baseReps * progressionFactor));
    const finalWeight = Math.max(0, Math.floor(baseWeight * progressionFactor));

    return {
      exerciseId: exercise._id,
      name: exercise.name,
      sets: finalSets,
      reps: finalReps,
      weight: finalWeight,
      restTime,
      notes: this.generateExerciseNotes(exercise, fitnessAnalysis),
      estimatedDuration: (finalSets * finalReps * 3) + (finalSets * restTime), // seconds
      difficulty: this.calculateExerciseDifficulty(exercise, fitnessAnalysis)
    };
  }

  // Calculate base sets for exercise
  calculateBaseSets(exercise, fitnessAnalysis) {
    const baseSets = {
      'beginner': 2,
      'intermediate': 3,
      'advanced': 4,
      'expert': 5
    };

    let sets = baseSets[fitnessAnalysis.experienceLevel] || 2;

    // Adjust based on exercise type
    if (exercise.category === 'cardio') {
      sets = 1;
    } else if (exercise.category === 'strength') {
      sets = Math.min(sets + 1, 6);
    }

    return sets;
  }

  // Calculate base reps for exercise
  calculateBaseReps(exercise, fitnessAnalysis, goals) {
    let reps = 8; // Default

    // Adjust based on goals
    if (goals.includes('muscle_gain')) {
      reps = 8;
    } else if (goals.includes('strength')) {
      reps = 5;
    } else if (goals.includes('endurance')) {
      reps = 15;
    }

    // Adjust based on exercise type
    if (exercise.category === 'cardio') {
      reps = 1; // Duration-based
    } else if (exercise.category === 'strength') {
      reps = Math.max(1, reps - 2);
    }

    return reps;
  }

  // Calculate base weight
  calculateBaseWeight(exercise, fitnessAnalysis) {
    if (exercise.category === 'cardio' || exercise.equipment?.includes('none')) {
      return 0;
    }

    const strengthLevel = fitnessAnalysis.strengthLevel;
    const baseWeights = {
      'beginner': 5,
      'intermediate': 15,
      'advanced': 30,
      'expert': 50
    };

    return baseWeights[strengthLevel] || 5;
  }

  // Calculate rest time
  calculateRestTime(exercise, fitnessAnalysis) {
    if (exercise.category === 'cardio') return 30;
    
    const baseRest = {
      'beginner': 60,
      'intermediate': 90,
      'advanced': 120,
      'expert': 180
    };

    return baseRest[fitnessAnalysis.experienceLevel] || 60;
  }

  // Calculate progression factor
  calculateProgressionFactor(week, day, fitnessAnalysis) {
    const baseProgression = 1 + (week - 1) * 0.1; // 10% increase per week
    const dayProgression = 1 + (day - 1) * 0.02; // 2% increase per day
    
    return Math.min(baseProgression * dayProgression, 1.5); // Cap at 50% increase
  }

  // Generate exercise notes
  generateExerciseNotes(exercise, fitnessAnalysis) {
    const notes = [];
    
    if (fitnessAnalysis.injuryRisk > 0.5) {
      notes.push('Focus on proper form and controlled movement');
    }
    
    if (fitnessAnalysis.experienceLevel === 'beginner') {
      notes.push('Start with lighter weight to master form');
    }
    
    if (exercise.category === 'cardio') {
      notes.push('Maintain steady pace throughout');
    }

    return notes.join('. ');
  }

  // Calculate exercise difficulty
  calculateExerciseDifficulty(exercise, fitnessAnalysis) {
    const difficultyMap = { 'beginner': 1, 'intermediate': 2, 'advanced': 3, 'expert': 4 };
    const userLevel = difficultyMap[fitnessAnalysis.experienceLevel] || 1;
    const exerciseLevel = difficultyMap[exercise.difficulty] || 1;
    
    return Math.max(1, Math.min(5, userLevel + exerciseLevel - 1));
  }

  // Helper methods
  getAverageWeight(workouts) {
    if (workouts.length === 0) return 0;
    
    const totalWeight = workouts.reduce((sum, w) => {
      const maxWeight = Math.max(...w.performance.sets.map(s => s.weight || 0));
      return sum + maxWeight;
    }, 0);
    
    return totalWeight / workouts.length;
  }

  generatePlanName(goals, fitnessAnalysis) {
    const goalNames = {
      'weight_loss': 'Giảm Cân',
      'muscle_gain': 'Tăng Cơ',
      'endurance': 'Sức Bền',
      'strength': 'Sức Mạnh',
      'flexibility': 'Linh Hoạt',
      'general_fitness': 'Tổng Quát'
    };
    
    const levelNames = {
      'beginner': 'Cơ Bản',
      'intermediate': 'Trung Cấp',
      'advanced': 'Nâng Cao',
      'expert': 'Chuyên Nghiệp'
    };
    
    const primaryGoal = goals[0] || 'general_fitness';
    const level = fitnessAnalysis.experienceLevel || 'beginner';
    
    return `Kế Hoạch ${goalNames[primaryGoal]} - ${levelNames[level]}`;
  }

  generatePlanDescription(goals, fitnessAnalysis) {
    return `Kế hoạch tập luyện được tùy chỉnh cho mục tiêu ${goals.join(', ')} và trình độ ${fitnessAnalysis.experienceLevel}`;
  }

  calculateDifficulty(fitnessAnalysis) {
    const difficultyMap = { 'beginner': 1, 'intermediate': 2, 'advanced': 3, 'expert': 4 };
    return difficultyMap[fitnessAnalysis.experienceLevel] || 1;
  }

  calculateRestDays(frequency) {
    return 7 - frequency;
  }

  calculateProgression(fitnessAnalysis) {
    return {
      rate: Math.min(fitnessAnalysis.progressionRate + 0.1, 0.3),
      method: 'linear',
      deloadWeek: 4
    };
  }

  getWorkoutDayName(day, goals) {
    const dayNames = ['Ngày 1', 'Ngày 2', 'Ngày 3', 'Ngày 4', 'Ngày 5', 'Ngày 6', 'Ngày 7'];
    return dayNames[day - 1] || `Ngày ${day}`;
  }

  getWorkoutFocus(day, goals, fitnessAnalysis) {
    const focuses = ['upper_body', 'lower_body', 'core', 'full_body', 'cardio'];
    return focuses[(day - 1) % focuses.length];
  }

  extractPersonalizationFactors(preferences, fitnessAnalysis) {
    return [
      { factor: 'fitness_level', weight: 0.3, applied: true },
      { factor: 'goals', weight: 0.25, applied: true },
      { factor: 'equipment', weight: 0.15, applied: true },
      { factor: 'time_constraints', weight: 0.1, applied: true },
      { factor: 'injury_history', weight: 0.1, applied: true },
      { factor: 'preferences', weight: 0.05, applied: true },
      { factor: 'performance_history', weight: 0.05, applied: true }
    ];
  }

  predictPerformance(workoutPlan, fitnessAnalysis) {
    return {
      expectedDifficulty: Math.min(10, Math.max(1, fitnessAnalysis.motivationLevel + 2)),
      expectedDuration: workoutPlan.exercises.reduce((sum, day) => sum + day.estimatedDuration, 0) / 60, // minutes
      expectedCalories: 300, // Estimated
      successProbability: Math.min(0.9, 0.5 + fitnessAnalysis.consistency * 0.4)
    };
  }

  calculateConfidence(fitnessAnalysis) {
    let confidence = 0.5; // Base confidence
    
    if (fitnessAnalysis.consistency > 0.7) confidence += 0.2;
    if (fitnessAnalysis.progressionRate > 0.1) confidence += 0.1;
    if (fitnessAnalysis.injuryRisk < 0.3) confidence += 0.1;
    if (fitnessAnalysis.motivationLevel > 7) confidence += 0.1;
    
    return Math.min(confidence, 0.95);
  }

  generateRecommendations(fitnessAnalysis) {
    const recommendations = [];
    
    if (fitnessAnalysis.consistency < 0.5) {
      recommendations.push('Tăng tần suất tập luyện để cải thiện kết quả');
    }
    
    if (fitnessAnalysis.injuryRisk > 0.5) {
      recommendations.push('Tập trung vào kỹ thuật và khởi động kỹ lưỡng');
    }
    
    if (fitnessAnalysis.progressionRate < 0.05) {
      recommendations.push('Thử tăng cường độ hoặc thay đổi bài tập');
    }
    
    return recommendations;
  }
}

module.exports = new AIWorkoutPlanner();
