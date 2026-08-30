import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Playground } from './components/Playground';
import { ReviewConsole } from './components/ReviewConsole';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { PolicyManager } from './components/PolicyManager';
import { KnowledgeBaseView } from './components/KnowledgeBaseView';
import { apiClient } from './api/client';

export function App() {
  const [activeTab, setActiveTab] = useState('playground');
  const [pendingReviewsCount, setPendingReviewsCount] = useState(1);

  const refreshPendingCount = async () => {
    try {
      const reviews = await apiClient.getReviews('PENDING');
      setPendingReviewsCount(reviews.length);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingReviewsCount={pendingReviewsCount}
      />

      {/* Dynamic View Body */}
      <main style={{ flex: 1 }}>
        {activeTab === 'playground' && (
          <Playground
            onNavigateToReviews={() => setActiveTab('reviews')}
            onRefreshAnalytics={refreshPendingCount}
          />
        )}
        {activeTab === 'reviews' && (
          <ReviewConsole onRefreshStats={refreshPendingCount} />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsDashboard />
        )}
        {activeTab === 'policies' && (
          <PolicyManager />
        )}
        {activeTab === 'knowledge' && (
          <KnowledgeBaseView />
        )}
      </main>

    </div>
  );
}

export default App;
