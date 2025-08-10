// Google Analytics utility functions
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

// Initialize Google Analytics
export const initGA = () => {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  
  if (!measurementId) {
    console.warn('Google Analytics measurement ID not found');
    return;
  }

  // gtag is already initialized in index.html
  if (typeof window.gtag === 'function') {
    console.log('Google Analytics initialized with ID:', measurementId);
  }
};

// Track page views
export const trackPageView = (pagePath: string, pageTitle?: string) => {
  if (typeof window.gtag === 'function') {
    window.gtag('config', import.meta.env.VITE_GA_MEASUREMENT_ID, {
      page_path: pagePath,
      page_title: pageTitle,
    });
  }
};

// Track custom events
export const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, {
      ...parameters,
      // Add timestamp for better tracking
      timestamp: new Date().toISOString(),
    });
  }
};

// Specific tracking functions for CollegeBot events

// Wizard stage tracking
export const trackWizardStageEntered = (stage: string, studentId?: string) => {
  trackEvent('wizard_stage_entered', {
    stage_name: stage,
    student_id: studentId,
    event_category: 'wizard_navigation',
  });
};

export const trackWizardStageCompleted = (stage: string, studentId?: string) => {
  trackEvent('wizard_stage_completed', {
    stage_name: stage,
    student_id: studentId,
    event_category: 'wizard_navigation',
  });
};

// AI interaction tracking
export const trackAIChatMessage = (messageType: 'user' | 'assistant', stage?: string, studentId?: string) => {
  trackEvent('ai_chat_message_sent', {
    message_type: messageType,
    current_stage: stage,
    student_id: studentId,
    event_category: 'ai_interaction',
  });
};

export const trackRecommendationGenerated = (recommendationCount: number, studentId?: string) => {
  trackEvent('recommendation_generated', {
    recommendation_count: recommendationCount,
    student_id: studentId,
    event_category: 'ai_interaction',
  });
};

// Feature usage tracking
export const trackMapInteraction = (action: string, locationName?: string, studentId?: string) => {
  trackEvent('map_interaction', {
    action,
    location_name: locationName,
    student_id: studentId,
    event_category: 'feature_usage',
  });
};

export const trackCalendarAction = (action: string, itemType?: 'task' | 'event', studentId?: string) => {
  trackEvent('calendar_action', {
    action,
    item_type: itemType,
    student_id: studentId,
    event_category: 'feature_usage',
  });
};

export const trackResearchInitiated = (researchType: string, collegeName?: string, studentId?: string) => {
  trackEvent('research_initiated', {
    research_type: researchType,
    college_name: collegeName,
    student_id: studentId,
    event_category: 'feature_usage',
  });
};

// Business metrics tracking
export const trackProfileCompleted = (studentId?: string) => {
  trackEvent('profile_completed', {
    student_id: studentId,
    event_category: 'conversion',
  });
};

export const trackCollegeListGenerated = (collegeCount: number, studentId?: string) => {
  trackEvent('college_list_generated', {
    college_count: collegeCount,
    student_id: studentId,
    event_category: 'conversion',
  });
};

export const trackScholarshipOpportunityViewed = (scholarshipName?: string, studentId?: string) => {
  trackEvent('scholarship_opportunity_viewed', {
    scholarship_name: scholarshipName,
    student_id: studentId,
    event_category: 'engagement',
  });
};

export const trackApplicationDeadlineSet = (collegeName?: string, deadlineDate?: string, studentId?: string) => {
  trackEvent('application_deadline_set', {
    college_name: collegeName,
    deadline_date: deadlineDate,
    student_id: studentId,
    event_category: 'engagement',
  });
};

export const trackPlanCreated = (planType: string, itemCount: number, studentId?: string) => {
  trackEvent('plan_created', {
    plan_type: planType,
    item_count: itemCount,
    student_id: studentId,
    event_category: 'conversion',
  });
};

// Admin and settings tracking
export const trackAdminAction = (action: string, userId?: string) => {
  trackEvent('admin_action', {
    action,
    user_id: userId,
    event_category: 'admin',
  });
};

export const trackSettingsChanged = (settingType: string, newValue?: string, userId?: string) => {
  trackEvent('settings_changed', {
    setting_type: settingType,
    new_value: newValue,
    user_id: userId,
    event_category: 'settings',
  });
};

// Error tracking
export const trackError = (errorType: string, errorMessage?: string, context?: string) => {
  trackEvent('error_occurred', {
    error_type: errorType,
    error_message: errorMessage,
    context,
    event_category: 'error',
  });
};

// User authentication tracking
export const trackUserLogin = (userId?: string) => {
  trackEvent('login', {
    user_id: userId,
    event_category: 'authentication',
  });
};

export const trackUserLogout = (userId?: string) => {
  trackEvent('logout', {
    user_id: userId,
    event_category: 'authentication',
  });
};
